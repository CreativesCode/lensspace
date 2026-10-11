import type { Audience, DocSectionType, ManualAudience } from './types'

export const COPY = {
  sectionTitle: { overview: 'Para empezar', access: 'Cómo entrar', roles: 'Quién hace qué', faq: 'Preguntas que siempre salen', support: 'Ayuda', policy: 'Reglas de la casa' },
  sectionTypeLabel: { overview: 'Para empezar', access: 'Entrar', roles: 'Quién hace qué', module: 'Sección', workflow: 'Paso a paso', faq: 'Preguntas', support: 'Ayuda', policy: 'Reglas' } satisfies Record<DocSectionType, string>,
  audienceLabel: { 'end-user': 'todo el equipo', admin: 'el dueño', support: 'ayuda' } satisfies Record<Audience, string>,
  docType: { worker: 'Guía del equipo', admin: 'Guía del dueño', platform: 'Guía de la plataforma' } satisfies Record<ManualAudience, string>,
  manualTitle: (audience: ManualAudience, app: string) => `${COPY.docType[audience]} · ${app}`,
  manualSubtitle: (audience: ManualAudience, client: string) => audience === 'platform' ? `Cómo se administra ${client}: ópticas, contratos, cobros y sucursales`
    : audience === 'admin' ? `Todo lo que necesitas para llevar ${client}` : `Cómo hacer el trabajo de cada día en ${client}`,
}
