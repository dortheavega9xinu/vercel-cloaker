# Vercel Cloaker - standalone site

A tiny Next.js site that does one job: every human visitor who lands on your
domain is sent to the **destination URL** you set in the admin panel, while link
previews (Facebook, WhatsApp, iMessage, Slack, Discord, Twitter/X, ...) still
see a proper page with Open Graph metadata.

No Blogger, no external content source. The domain is self-contained.

---

## What changed from the Blogger version

| Before | Now |
|---|---|
| Post content fetched from the Blogger API on every request | Nothing external - the page uses the title/description/image you configure |
| `BLOGGER_API_KEY`, `BLOGGER_BLOG_ID`, `BLOG_DOMAIN` env vars | One `DESTINATION_URL` (set from the admin panel) |
| Built to mirror Blogger post paths | Any path on the domain behaves the same |
| Changing anything required a redeploy | Admin panel at `/{ADMIN_PATH}` |

---

## How it works

For every request:

1. If the visitor looks like a crawler/bot **and** "Never redirect bots" is on,
   the page (with OG tags) is returned, so the preview card renders.
2. Otherwise, if the redirect mode matches, the visitor is sent to the
   destination URL - instantly (HTTP 302) or after a delay.
3. The admin panel is never linked from the public page, is `noindex, nofollow`
   and is disallowed in `robots.txt`.

### Redirect modes

| Mode | Behaviour |
|---|---|
| `always` (default) | Every human visitor is redirected |
| `referrer` | Only visitors coming from Facebook/Instagram or with an `fbclid` param (the old behaviour) |
| `off` | Nobody is redirected - the site is just a normal page |

---

## Setup

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for the public page and
`http://localhost:3000/admin` for the panel (or whatever you set `ADMIN_PATH` to).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | yes | Password for the panel |
| `ADMIN_PATH` | no | Path of the panel, default `admin` -> `domain.com/admin` |
| `SESSION_SECRET` | no | Signs the login cookie; defaults to `ADMIN_PASSWORD` |
| `DESTINATION_URL` | no | Initial destination; editable from the panel |
| `REDIRECT_MODE` | no | `always` / `referrer` / `off` |
| `REDIRECT_DELAY_MS` | no | `0` = instant |
| `SKIP_CRAWLERS` | no | `true` = bots get the page, not the redirect |
| `SITE_TITLE`, `SITE_NAME`, `META_DESCRIPTION`, `OG_IMAGE` | no | Preview metadata defaults |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | in production | Persistent storage (see below) |

Values from `.env` are only defaults: as soon as you save in the panel, the
saved settings win.

---

## Where settings are stored

`lib/settings.ts` supports two backends and picks one automatically:

1. **Upstash Redis / Vercel KV** - used when `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` are set. This is what you want in production, because a
   Vercel deployment has a read-only filesystem.
2. **Local file** - `data/settings.json`, used in development. The admin panel
   shows a banner when this backend is active.

To enable Redis: in the Vercel dashboard open your project, go to
**Storage**, create an Upstash Redis / KV database and connect it to the
project (or copy the REST URL + token from the Upstash console into those two
environment variables), then redeploy.

---

## Deploying to Vercel

1. Push this folder to a GitHub repository (`.env.local` and
   `data/settings.json` are gitignored).
2. In Vercel: **Add New Project**, import the repo.
3. Add the environment variables from the table above (at minimum
   `ADMIN_PASSWORD`, plus the KV credentials).
4. Deploy, then open `https://your-domain/admin` and set the destination URL.

---

## Using a different admin path

Set `ADMIN_PATH=my-secret-panel` and the panel moves to
`domain.com/my-secret-panel`. The old `/admin` path then renders the normal
public page instead of the panel, so nothing points at the real one.

---

## Project structure

```
components/
  Admin.tsx           login + settings form
  PublicSite.tsx      public page + OG tags
lib/
  auth.ts             password check, signed session cookie
  publicPage.ts       redirect / bot logic
  request.ts          crawler + social referrer detection
  settings.ts         validation + storage (KV or file)
pages/
  [...slug].tsx       admin route + catch-all public route
  index.tsx           public page
  api/admin.ts        GET settings / POST login|logout|save
  api/robots.ts       generated robots.txt
styles/
next.config.js
```

---

## Troubleshooting

**"Could not save: no writable storage"** - you are in production without KV
credentials. Add `KV_REST_API_URL` / `KV_REST_API_TOKEN` and redeploy.

**Preview card is stale** - use the Facebook Sharing Debugger
(https://developers.facebook.com/tools/debug/) and re-scrape the URL.

**Locked out of the panel** - wrong passwords lock an IP for 10 minutes; wait,
or restart the server.

**Forgot the admin path** - it is whatever `ADMIN_PATH` is set to (default
`admin`).
