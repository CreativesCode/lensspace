import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Cuban links drop often: keep failed navigations pending and retry them when
    // the connection returns instead of falling back to the browser error page.
    useOffline: true,
  },
}

export default nextConfig
