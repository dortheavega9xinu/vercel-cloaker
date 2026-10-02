import type { NextApiRequest, NextApiResponse } from 'next'
import { adminPath } from '../../lib/auth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /${adminPath()}\nDisallow: /api/\n`)
}
