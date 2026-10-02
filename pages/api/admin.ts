import type { NextApiRequest, NextApiResponse } from 'next'
import {
  createSessionToken,
  expiredSessionCookie,
  isAdminConfigured,
  parseCookies,
  SESSION_COOKIE,
  sessionCookie,
  verifyPassword,
  verifySessionToken,
} from '../../lib/auth'
import { parseSettings, readSettings, storageIsPersistent, storageKind, writeSettings } from '../../lib/settings'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 10 * 60 * 1000
const attempts = new Map<string, { count: number; blockedUntil: number }>()

function clientKey(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const ip = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0].trim()
  return ip || req.socket?.remoteAddress || 'unknown'
}

function isLockedOut(key: string): boolean {
  const entry = attempts.get(key)
  if (!entry) return false
  if (entry.blockedUntil > Date.now()) return true
  if (entry.blockedUntil !== 0 && entry.blockedUntil <= Date.now()) attempts.delete(key)
  return false
}

function registerFailure(key: string) {
  const entry = attempts.get(key) || { count: 0, blockedUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) entry.blockedUntil = Date.now() + LOCKOUT_MS
  attempts.set(key, entry)
}

function safeJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const authed = verifySessionToken(parseCookies(req.headers.cookie)[SESSION_COOKIE])
    if (!authed) {
      return res.status(200).json({ authed: false, configured: isAdminConfigured(), storage: storageKind })
    }
    return res.status(200).json({
      authed: true,
      configured: true,
      storage: storageKind,
      persistent: storageIsPersistent,
      settings: await readSettings(),
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (typeof req.body === 'string' ? safeJson(req.body) : req.body) || {}
  const action = String(body.action || '')

  if (action === 'login') {
    if (!isAdminConfigured()) {
      return res.status(503).json({ error: 'ADMIN_PASSWORD is not configured.' })
    }
    const key = clientKey(req)
    if (isLockedOut(key)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in a few minutes.' })
    }
    if (!verifyPassword(String(body.password || ''))) {
      registerFailure(key)
      return res.status(401).json({ error: 'Invalid password.' })
    }
    attempts.delete(key)
    res.setHeader('Set-Cookie', sessionCookie(createSessionToken()))
    return res.status(200).json({ ok: true, settings: await readSettings() })
  }

  const authed = verifySessionToken(parseCookies(req.headers.cookie)[SESSION_COOKIE])
  if (!authed) return res.status(401).json({ error: 'Not signed in.' })

  if (action === 'logout') {
    res.setHeader('Set-Cookie', expiredSessionCookie())
    return res.status(200).json({ ok: true })
  }

  if (action === 'save') {
    try {
      const settings = parseSettings(body.settings)
      const saved = await writeSettings(settings)
      return res.status(200).json({ ok: true, settings: saved, persistent: storageIsPersistent })
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message })
    }
  }

  return res.status(400).json({ error: 'Unknown action.' })
}
