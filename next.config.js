/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [{ source: '/robots.txt', destination: '/api/robots' }],
      afterFiles: [],
      fallback: [],
    }
  },
}

module.exports = nextConfig
