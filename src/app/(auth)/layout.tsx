import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>
}
