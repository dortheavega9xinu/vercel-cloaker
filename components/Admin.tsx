import Head from 'next/head'
import { useState } from 'react'
import type { Settings } from '../lib/settings'
import styles from '../styles/admin.module.css'

export interface AdminProps {
  authed: boolean
  configured: boolean
  persistent: boolean
  initialSettings: Settings | null
}

type SaveState = { kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string }

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data && data.error) || 'Request failed')
  return data
}

export default function Admin({ authed, configured, persistent, initialSettings }: AdminProps) {
  const [loggedIn, setLoggedIn] = useState(authed)
  const [settings, setSettings] = useState<Settings | null>(initialSettings)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [state, setState] = useState<SaveState>({ kind: 'idle' })

  if (!configured) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <h1 className={styles.title}>Admin not configured</h1>
            <p className={styles.hint}>
              Set the <code>ADMIN_PASSWORD</code> environment variable (and optionally <code>ADMIN_PATH</code> and{' '}
              <code>SESSION_SECRET</code>) and redeploy to enable this panel.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await post({ action: 'login', password })
      setSettings(data.settings as Settings)
      setLoggedIn(true)
      setPassword('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    setBusy(true)
    try {
      await post({ action: 'logout' })
    } catch {
      // ignore - the local state is cleared either way
    } finally {
      setLoggedIn(false)
      setSettings(null)
      setBusy(false)
    }
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!settings) return
    setBusy(true)
    setState({ kind: 'saving' })
    try {
      const data = await post({ action: 'save', settings })
      setSettings(data.settings as Settings)
      setState({ kind: 'saved', message: 'Saved' })
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  if (!loggedIn || !settings) {
    return (
      <>
        <Head>
          <title>Sign in</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <main className={styles.page}>
          <form className={`${styles.card} ${styles.login}`} onSubmit={handleLogin}>
            <h1 className={styles.title}>Sign in</h1>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className={styles.input}
                type="password"
                value={password}
                autoComplete="current-password"
                autoFocus
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <p className={`${styles.status} ${styles.err}`}>{error}</p> : null}
            <button className={styles.button} type="submit" disabled={busy || !password}>
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </main>
      </>
    )
  }

  const update = (patch: Partial<Settings>) =>
    setSettings((current) => (current ? { ...current, ...patch } : current))

  return (
    <>
      <Head>
        <title>Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.header}>
            <div className={styles.brand}>
              <span className={styles.dot} />
              Control panel
            </div>
            <button className={`${styles.button} ${styles.ghost}`} onClick={handleLogout} disabled={busy} type="button">
              Sign out
            </button>
          </div>

          {!persistent ? (
            <div className={styles.banner}>
              Settings are stored in a local file (<code>data/settings.json</code>). That works while developing, but on
              Vercel the filesystem is read-only - add <code>KV_REST_API_URL</code> and <code>KV_REST_API_TOKEN</code>{' '}
              (Vercel KV / Upstash Redis) to persist changes in production.
            </div>
          ) : null}

          <form className={styles.card} onSubmit={handleSave}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="destinationUrl">
                Destination URL
              </label>
              <input
                id="destinationUrl"
                className={styles.input}
                type="url"
                placeholder="https://where-visitors-should-go.com"
                value={settings.destinationUrl}
                onChange={(event) => update({ destinationUrl: event.target.value })}
              />
              <span className={styles.hint}>Where real visitors are sent.</span>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="redirectMode">
                  Redirect mode
                </label>
                <select
                  id="redirectMode"
                  className={styles.select}
                  value={settings.redirectMode}
                  onChange={(event) => update({ redirectMode: event.target.value as Settings['redirectMode'] })}
                >
                  <option value="always">Always redirect visitors</option>
                  <option value="referrer">Only social traffic (facebook.com / fbclid)</option>
                  <option value="off">Off - just show the page</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="redirectDelay">
                  Delay (seconds)
                </label>
                <input
                  id="redirectDelay"
                  className={styles.input}
                  type="number"
                  min={0}
                  max={60}
                  value={Math.round(settings.redirectDelayMs / 1000)}
                  onChange={(event) =>
                    update({ redirectDelayMs: Math.min(60000, Math.max(0, Number(event.target.value) * 1000 || 0)) })
                  }
                />
                <span className={styles.hint}>0 = instant redirect.</span>
              </div>
            </div>

            <label className={styles.checkboxRow} htmlFor="skipCrawlers">
              <input
                id="skipCrawlers"
                className={styles.checkbox}
                type="checkbox"
                checked={settings.skipCrawlers}
                onChange={(event) => update({ skipCrawlers: event.target.checked })}
              />
              Never redirect link previews and bots (they read the page below instead)
            </label>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="siteTitle">
                Site title
              </label>
              <input
                id="siteTitle"
                className={styles.input}
                value={settings.siteTitle}
                onChange={(event) => update({ siteTitle: event.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="siteName">
                Site name
              </label>
              <input
                id="siteName"
                className={styles.input}
                value={settings.siteName}
                onChange={(event) => update({ siteName: event.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="metaDescription">
                Meta description
              </label>
              <textarea
                id="metaDescription"
                className={styles.textarea}
                rows={3}
                value={settings.metaDescription}
                onChange={(event) => update({ metaDescription: event.target.value })}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="ogImage">
                Preview image URL
              </label>
              <input
                id="ogImage"
                className={styles.input}
                type="url"
                placeholder="https://..."
                value={settings.ogImage}
                onChange={(event) => update({ ogImage: event.target.value })}
              />
            </div>

            <div className={styles.actions}>
              <button className={styles.button} type="submit" disabled={busy}>
                {busy ? 'Saving...' : 'Save settings'}
              </button>
              {state.kind === 'saved' ? <span className={`${styles.status} ${styles.ok}`}>{state.message}</span> : null}
              {state.kind === 'error' ? <span className={`${styles.status} ${styles.err}`}>{state.message}</span> : null}
            </div>

            {settings.updatedAt ? (
              <p className={styles.meta}>Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>
            ) : null}
          </form>
        </div>
      </main>
    </>
  )
}
