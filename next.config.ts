import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Cuban links drop often: keep failed navigations pending and retry them when
    // the connection returns instead of falling back to the browser error page.
    useOffline: true,
  },
  async headers() {
    return [
      {
        // The worker must always be revalidated so fixes reach users on the next load.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
