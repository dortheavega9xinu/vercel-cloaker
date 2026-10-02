import Head from 'next/head'
import { useEffect } from 'react'
import type { PublicPageProps } from '../lib/publicPage'
import styles from '../styles/public.module.css'

export default function PublicSite({ settings, redirectUrl, delayMs, canonicalUrl }: PublicPageProps) {
  useEffect(() => {
    if (!redirectUrl || delayMs <= 0) return
    const timer = setTimeout(() => {
      window.location.replace(redirectUrl)
    }, delayMs)
    return () => clearTimeout(timer)
  }, [redirectUrl, delayMs])

  return (
    <>
      <Head>
        <title>{settings.siteTitle}</title>
        <meta name="description" content={settings.metaDescription} />
        <link rel="canonical" href={canonicalUrl} />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={settings.siteName} />
        <meta property="og:title" content={settings.siteTitle} />
        <meta property="og:description" content={settings.metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        {settings.ogImage ? <meta property="og:image" content={settings.ogImage} /> : null}

        <meta name="twitter:card" content={settings.ogImage ? 'summary_large_image' : 'summary'} />
        <meta name="twitter:title" content={settings.siteTitle} />
        <meta name="twitter:description" content={settings.metaDescription} />
        {settings.ogImage ? <meta name="twitter:image" content={settings.ogImage} /> : null}

        {redirectUrl && delayMs > 0 ? (
          <meta
            httpEquiv="refresh"
            content={`${Math.max(1, Math.round(delayMs / 1000))};url=${redirectUrl}`}
          />
        ) : null}
      </Head>

      <main className={styles.page}>
        <div className={styles.card}>
          {settings.ogImage ? <img className={styles.image} src={settings.ogImage} alt="" /> : null}
          <h1 className={styles.title}>{settings.siteTitle}</h1>
          {settings.metaDescription ? <p className={styles.description}>{settings.metaDescription}</p> : null}
          <span className={styles.site}>{settings.siteName}</span>
        </div>
      </main>
    </>
  )
}
