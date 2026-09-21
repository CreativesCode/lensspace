import type { Metadata } from 'next'

import { LandingPage } from '@/features/landing/components/LandingPage'
import { siteConfig } from '@/shared/config/site'

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    url: '/',
    siteName: siteConfig.name,
    title: `${siteConfig.title} | ${siteConfig.name}`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.title} | ${siteConfig.name}`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
}

export default function Home() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: `${siteConfig.url}/brand/lensspace-app-icon-512.png`,
        description: siteConfig.promise,
      },
      {
        '@type': 'WebSite',
        '@id': `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: siteConfig.language,
        publisher: { '@id': `${siteConfig.url}/#organization` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${siteConfig.url}/#software`,
        name: siteConfig.name,
        url: siteConfig.url,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Software de gestión para ópticas',
        operatingSystem: 'Web',
        browserRequirements: 'Requiere un navegador web moderno.',
        description: siteConfig.description,
        inLanguage: siteConfig.language,
        publisher: { '@id': `${siteConfig.url}/#organization` },
        featureList: [
          'Gestión de clientes y recetas ópticas',
          'Ventas, cobros y saldos pendientes',
          'Seguimiento de producción y montaje',
          'Historial operativo verificable',
          'Permisos según la responsabilidad de cada persona',
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <LandingPage />
    </>
  )
}
