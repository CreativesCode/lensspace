import type { Audience, DocSectionType, ManualAudience } from './types'

export const COPY = {
  sectionTitle: { overview: 'Para empezar', access: 'Cómo entrar', roles: 'Quién hace qué', faq: 'Preguntas que siempre salen', support: 'Ayuda', policy: 'Reglas de la casa' },
  sectionTypeLabel: { overview: 'Para empezar', access: 'Entrar', roles: 'Quién hace qué', module: 'Sección', workflow: 'Paso a paso', faq: 'Preguntas', support: 'Ayuda', policy: 'Reglas' } satisfies Record<DocSectionType, string>,
  audienceLabel: { 'end-user': 'todo el equipo', admin: 'el dueño', support: 'ayuda' } satisfies Record<Audience, string>,
  manualTitle: (audience: ManualAudience, app: string) => audience === 'admin' ? `Guía del dueño · ${app}` : `Guía del equipo · ${app}`,
  manualSubtitle: (audience: ManualAudience, client: string) => audience === 'admin' ? `Todo lo que necesitas para llevar ${client}` : `Cómo hacer el trabajo de cada día en ${client}`,
}
