#!/usr/bin/env node
/**
 * Apply browser CORS on the LifeOS R2 bucket so iPhone/Safari can PUT
 * presigned uploads from https://vps-01d88277.vps.ovh.net.
 *
 * Env: R2_ACCOUNT_ID or R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * optional R2_BUCKET (default lifeos-production), R2_REGION (default auto),
 * optional LIFEOS_SITE_ORIGIN (default https://vps-01d88277.vps.ovh.net).
 */
import { PutBucketCorsCommand, GetBucketCorsCommand, S3Client } from '@aws-sdk/client-s3'

function env(name) {
  return process.env[name]?.trim() ?? ''
}

const accountId = env('R2_ACCOUNT_ID')
const endpoint = (env('R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')).replace(/\/$/, '')
const bucket = env('R2_BUCKET') || 'lifeos-production'
const origin = (env('LIFEOS_SITE_ORIGIN') || 'https://vps-01d88277.vps.ovh.net').replace(/\/$/, '')
const accessKeyId = env('R2_ACCESS_KEY_ID')
const secretAccessKey = env('R2_SECRET_ACCESS_KEY')

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error('Missing R2_ENDPOINT/R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY')
  process.exit(1)
}

const client = new S3Client({
  region: env('R2_REGION') || 'auto',
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
})

const cors = {
  CORSRules: [
    {
      AllowedOrigins: [origin],
      AllowedMethods: ['PUT', 'GET', 'HEAD'],
      AllowedHeaders: ['Content-Type', 'content-type'],
      ExposeHeaders: ['ETag', 'etag'],
      MaxAgeSeconds: 3600,
    },
  ],
}

await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: cors }))
const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }))
console.log(JSON.stringify({
  ok: true,
  bucket,
  origin,
  rules: current.CORSRules ?? [],
}, null, 2))
