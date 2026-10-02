import fs from 'fs'
import path from 'path'

export type RedirectMode = 'always' | 'referrer' | 'off'

export interface Settings {
  destinationUrl: string
  redirectMode: RedirectMode
  redirectDelayMs: number
  skipCrawlers: boolean
  siteTitle: string
  siteName: string
  metaDescription: string
  ogImage: string
  updatedAt: string | null
}

const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '')
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
const KV_KEY = 'vercel-cloaker:settings'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'settings.json')

export const storageKind: 'kv' | 'file' = KV_URL && KV_TOKEN ? 'kv' : 'file'
export const storageIsPersistent = storageKind === 'kv'

const CACHE_TTL_MS = 5000
let cache: { value: Settings; at: number } | null = null

export function normalizeMode(value: unknown, fallback: RedirectMode = 'always'): RedirectMode {
  if (value === 'always' || value === 'referrer' || value === 'off') return value
  return fallback
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function text(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\/[^\s]+$/i.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function defaultSettings(): Settings {
  const title = text(process.env.SITE_TITLE, 200) || 'My Site'
  return {
    destinationUrl: text(process.env.DESTINATION_URL, 2048),
    redirectMode: normalizeMode(process.env.REDIRECT_MODE),
    redirectDelayMs: clampInt(process.env.REDIRECT_DELAY_MS, 0, 0, 60000),
    skipCrawlers: process.env.SKIP_CRAWLERS !== 'false',
    siteTitle: title,
    siteName: text(process.env.SITE_NAME, 200) || title,
    metaDescription: text(process.env.META_DESCRIPTION, 500),
    ogImage: text(process.env.OG_IMAGE, 2048),
    updatedAt: null,
  }
}

export function parseSettings(input: unknown): Settings {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>

  const destinationUrl = text(raw.destinationUrl, 2048)
  if (destinationUrl && !isHttpUrl(destinationUrl)) {
    throw new Error('Destination URL must be a full URL starting with http:// or https://')
  }

  const redirectMode = normalizeMode(raw.redirectMode, 'always')
  if (redirectMode !== 'off' && !destinationUrl) {
    throw new Error('A destination URL is required unless redirect mode is set to "off".')
  }

  const ogImage = text(raw.ogImage, 2048)
  if (ogImage && !isHttpUrl(ogImage)) {
    throw new Error('Preview image must be a full URL starting with http:// or https://')
  }

  const siteTitle = text(raw.siteTitle, 200) || 'My Site'

  return {
    destinationUrl,
    redirectMode,
    redirectDelayMs: clampInt(raw.redirectDelayMs, 0, 0, 60000),
    skipCrawlers: raw.skipCrawlers !== false && raw.skipCrawlers !== 'false',
    siteTitle,
    siteName: text(raw.siteName, 200) || siteTitle,
    metaDescription: text(raw.metaDescription, 500),
    ogImage,
    updatedAt: null,
  }
}

async function kvCommand(command: (string | number)[]): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Storage request failed (HTTP ${res.status})`)
    const data = (await res.json()) as { result?: unknown }
    return data ? data.result ?? null : null
  } finally {
    clearTimeout(timer)
  }
}

async function readStored(): Promise<Partial<Settings> | null> {
  try {
    let raw: string | null = null

    if (storageKind === 'kv') {
      const value = await kvCommand(['GET', KV_KEY])
      raw = typeof value === 'string' ? value : null
    } else if (fs.existsSync(DATA_FILE)) {
      raw = fs.readFileSync(DATA_FILE, 'utf8')
    }

    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Settings>) : null
  } catch {
    return null
  }
}

export async function readSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value
  const stored = await readStored()
  const value: Settings = { ...defaultSettings(), ...(stored || {}) }
  cache = { value, at: Date.now() }
  return value
}

export async function writeSettings(settings: Settings): Promise<Settings> {
  const value: Settings = { ...settings, updatedAt: new Date().toISOString() }

  if (storageKind === 'kv') {
    await kvCommand(['SET', KV_KEY, JSON.stringify(value)])
    cache = { value, at: Date.now() }
    return value
  }

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify(value, null, 2), 'utf8')
  } catch {
    throw new Error(
      'Could not save: no writable storage. Add Upstash/Vercel KV credentials (KV_REST_API_URL and KV_REST_API_TOKEN) so settings can persist in production.'
    )
  }

  cache = { value, at: Date.now() }
  return value
}
