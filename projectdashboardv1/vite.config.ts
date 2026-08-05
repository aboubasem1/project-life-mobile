import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const syncRouterPath = path.resolve(rootDir, '../server/sync-router.ts')

function lifeOsSyncDevPlugin(): Plugin {
  return {
    name: 'life-os-sync-dev-api',
    configureServer(server: ViteDevServer) {
      const env = loadEnv(server.config.mode, server.config.envDir, '')
      if (env.UPSTASH_REDIS_REST_URL) process.env.UPSTASH_REDIS_REST_URL = env.UPSTASH_REDIS_REST_URL
      if (env.UPSTASH_REDIS_REST_TOKEN) process.env.UPSTASH_REDIS_REST_TOKEN = env.UPSTASH_REDIS_REST_TOKEN

      server.middlewares.use((req, res, next) => {
        void (async () => {
          const url = req.url ?? ''
          if (!url.startsWith('/api/sync')) {
            next()
            return
          }

          try {
            const mod = await server.ssrLoadModule(`/@fs/${syncRouterPath}`) as {
              handleSyncRequest: (request: Request) => Promise<Response>
            }

            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on('data', (chunk: Buffer | string) => {
                chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
              })
              req.on('end', () => resolve())
              req.on('error', reject)
            })

            const bodyText = Buffer.concat(chunks).toString('utf8')
            const request = new Request(`http://127.0.0.1${url}`, {
              method: req.method ?? 'GET',
              headers: {
                'Content-Type': req.headers['content-type'] ?? 'application/json',
              },
              body: req.method && !['GET', 'HEAD'].includes(req.method) ? bodyText : undefined,
            })

            const response = await mod.handleSyncRequest(request)
            res.statusCode = response.status
            response.headers.forEach((value, key) => {
              res.setHeader(key, value)
            })
            res.end(Buffer.from(await response.arrayBuffer()))
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: error instanceof Error ? error.message : 'Sync-Dev-Proxy Fehler',
            }))
          }
        })().catch((error: unknown) => {
          next(error instanceof Error ? error : new Error('Sync proxy failed'))
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    lifeOsSyncDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Life OS',
        short_name: 'Life OS',
        description: 'Persönliches Life-Tracking — lokal, ruhig, fokussiert',
        lang: 'de',
        theme_color: '#0f1419',
        background_color: '#0f1419',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [
          /^\/developer(?:\/|$)/,
          /^\/api(?:\/|$)/,
        ],
      },
    }),
  ],
  server: {
    fs: {
      allow: [path.resolve(rootDir, '..')],
    },
  },
})
