import type { GetServerSidePropsContext } from 'next'
import { adminPath } from './auth'
import { isCrawler, isSocialReferrer } from './request'
import { readSettings, type Settings } from './settings'

export interface PublicPageProps {
  settings: Settings
  redirectUrl: string
  delayMs: number
  canonicalUrl: string
}

export type PublicPageResult =
  | { props: PublicPageProps }
  | { redirect: { destination: string; permanent: boolean } }
  | { notFound: true }

export const getPublicPageProps = async (ctx: GetServerSidePropsContext): Promise<PublicPageResult> => {
  const pathname = (ctx.resolvedUrl || '/').split('?')[0]
  const admin = `/${adminPath()}`
  if (pathname === admin || pathname.startsWith(`${admin}/`)) return { notFound: true }

  const settings = await readSettings()
  const userAgent = String(ctx.req.headers['user-agent'] || '')
  const referer = String(ctx.req.headers.referer || '')
  const hasFbclid = typeof ctx.query.fbclid !== 'undefined'

  let shouldRedirect = false
  if (settings.redirectMode === 'always') shouldRedirect = true
  else if (settings.redirectMode === 'referrer') shouldRedirect = isSocialReferrer(referer) || hasFbclid

  if (!settings.destinationUrl) shouldRedirect = false
  if (shouldRedirect && settings.skipCrawlers && isCrawler(userAgent)) shouldRedirect = false

  if (shouldRedirect && settings.redirectDelayMs <= 0) {
    return {
      redirect: {
        destination: settings.destinationUrl,
        permanent: false,
      },
    }
  }

  const host = ctx.req.headers.host || ''
  const proto = String(ctx.req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https'

  return {
    props: {
      settings,
      redirectUrl: shouldRedirect ? settings.destinationUrl : '',
      delayMs: shouldRedirect ? settings.redirectDelayMs : 0,
      canonicalUrl: `${proto}://${host}${pathname}`,
    },
  }
}
