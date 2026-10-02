import dynamic from 'next/dynamic'
import type { GetServerSideProps } from 'next'
import PublicSite from '../components/PublicSite'
import type { AdminProps } from '../components/Admin'
import { adminPath, isAdminConfigured, parseCookies, SESSION_COOKIE, verifySessionToken } from '../lib/auth'
import { getPublicPageProps, type PublicPageProps } from '../lib/publicPage'
import { readSettings, storageIsPersistent } from '../lib/settings'

const Admin = dynamic(() => import('../components/Admin'), { ssr: false })

type CatchAllProps =
  | ({ view: 'public' } & PublicPageProps)
  | { view: 'admin'; admin: AdminProps }

export default function CatchAll(props: CatchAllProps) {
  if (props.view === 'admin') return <Admin {...props.admin} />
  const { view, ...publicProps } = props
  return <PublicSite {...publicProps} />
}

export const getServerSideProps: GetServerSideProps<CatchAllProps> = async (ctx) => {
  const segments = (ctx.params?.slug as string[] | undefined) || []
  const first = segments[0] || ''

  if (first === adminPath()) {
    ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')

    const configured = isAdminConfigured()
    const authed = configured && verifySessionToken(parseCookies(ctx.req.headers.cookie)[SESSION_COOKIE])

    return {
      props: {
        view: 'admin',
        admin: {
          authed,
          configured,
          persistent: storageIsPersistent,
          initialSettings: authed ? await readSettings() : null,
        },
      },
    }
  }

  const result = await getPublicPageProps(ctx)
  if (!('props' in result)) return result
  return { props: { view: 'public', ...result.props } }
}
