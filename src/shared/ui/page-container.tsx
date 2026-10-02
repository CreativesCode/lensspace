import type { ReactNode } from 'react'

import { cx } from './cx'

// Guide main area: max 1440, 24 px top, clamp(16, 2.6vw, 36) sides, 48 px bottom, 20 px between blocks.
export function PageContainer({ narrow = false, children }: { narrow?: boolean; children: ReactNode }) {
  return (
    <section className={cx('mx-auto flex flex-col gap-5 px-4 pb-10 pt-5 md:px-[clamp(16px,2.6vw,36px)] md:pb-12 md:pt-6', narrow ? 'max-w-[1280px]' : 'max-w-[1440px]')}>
      {children}
    </section>
  )
}
