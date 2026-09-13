import type { Metadata } from 'next'
import { Source_Sans_3, Space_Grotesk } from 'next/font/google'
import './globals.css'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vision Studio',
  description: 'Gestión integral para ópticas',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sourceSans.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  )
}
