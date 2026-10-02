const CRAWLER_PATTERN =
  /(bot|crawler|spider|crawling|facebookexternalhit|facebot|facebookcatalog|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|embedly|pinterest|redditbot|applebot|googlebot|bingbot|yandex|duckduckbot|baiduspider|semrushbot|ahrefsbot|screaming frog|curl\/|wget\/|python-requests|httpx|axios|go-http-client|headlesschrome|phantomjs|preview)/i

export function isCrawler(userAgent: string): boolean {
  if (!userAgent) return false
  return CRAWLER_PATTERN.test(userAgent)
}

export function isSocialReferrer(referer: string): boolean {
  if (!referer) return false
  return /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|instagram\.com|l\.facebook\.com|messenger\.com)/i.test(
    referer
  )
}
