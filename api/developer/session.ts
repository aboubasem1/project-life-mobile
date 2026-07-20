import {
  clearSessionCookie,
  createSessionCookie,
  errorResponse,
  isAdmin,
  json,
  readJson,
  verifyAdminPassword,
} from '../../server/developer-admin'

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === 'GET') {
      return json({ authenticated: isAdmin(request) })
    }

    if (request.method === 'DELETE') {
      return json(
        { authenticated: false },
        200,
        { 'Set-Cookie': clearSessionCookie() },
      )
    }

    if (request.method !== 'POST') {
      return json({ error: 'Methode nicht erlaubt.' }, 405, { Allow: 'GET, POST, DELETE' })
    }

    const body = await readJson<{ password?: unknown }>(request)
    const password = String(body.password ?? '')

    if (!password || !verifyAdminPassword(password)) {
      return json({ error: 'Falsches Admin-Passwort.' }, 401)
    }

    return json(
      { authenticated: true },
      200,
      { 'Set-Cookie': createSessionCookie() },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
