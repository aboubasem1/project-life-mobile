export function shouldStreamRequest(method: string | undefined, pathname: string): boolean {
  return method === 'PUT' && pathname.replace(/\/$/, '') === '/api/storage/proxy-upload'
}
