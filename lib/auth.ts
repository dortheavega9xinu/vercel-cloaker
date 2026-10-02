import crypto from 'crypto'

export const SESSION_COOKIE = 'vc_admin_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function adminPath(): string {
  const raw = (process.env.ADMIN_PATH || 'admin').trim().replace(/^\/+|\/+$/g, '')
  return raw || 'admin'
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD)
}

function secret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || ''
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return crypto.timingSafeEqual(bufferA, bufferB)
}

export function createSessionToken(): string {
  const payload = `v1.${Date.now() + SESSION_TTL_MS}`
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || !secret()) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const payload = `${parts[0]}.${parts[1]}`
  if (!safeEqual(parts[2], sign(payload))) return false

  const expiresAt = Number(parts[1])
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || ''
  if (!expected) return false
  const given = crypto.createHash('sha256').update(String(input)).digest()
  const wanted = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(given, wanted)
}

export function sessionCookie(token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

export function expiredSessionCookie(): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!header) return cookies

  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (!key) continue
    try {
      cookies[key] = decodeURIComponent(value)
    } catch {
      cookies[key] = value
    }
  }

  return cookies
}
