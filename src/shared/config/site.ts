const fallbackSiteUrl = 'https://lensspace.vercel.app'

function resolveSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (!configuredUrl || configuredUrl.includes('localhost')) return fallbackSiteUrl

  try {
    return new URL(configuredUrl).origin
  } catch {
    return fallbackSiteUrl
  }
}

export const siteConfig = {
  name: 'LensSpace',
  url: resolveSiteUrl(),
  locale: 'es_CU',
  language: 'es',
  title: 'Software de gestión para ópticas',
  description:
    'LensSpace conecta clientes, recetas, ventas, cobros y producción para gestionar cada pedido óptico, desde la receta hasta la entrega.',
  promise: 'Toda tu operación óptica, claramente conectada.',
} as const

