import type { MetadataRoute } from 'next'

import { siteConfig } from '@/shared/config/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LensSpace',
    short_name: 'LensSpace',
    description: siteConfig.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: siteConfig.language,
    categories: ['business', 'productivity'],
    background_color: '#F0FBF9',
    theme_color: '#07322F',
    icons: [
      {
        src: '/brand/lensspace-app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand/lensspace-app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
