import type { Audience, DocSectionType, ManualAudience } from './types'

export const COPY = {
  sectionTitle: { overview: 'Vista general', access: 'Acceso al sistema', roles: 'Roles y permisos', faq: 'Preguntas frecuentes', support: 'Soporte y contacto', policy: 'Políticas de uso' },
  sectionTypeLabel: { overview: 'Vista general', access: 'Acceso', roles: 'Roles', module: 'Módulo', workflow: 'Flujo', faq: 'Preguntas frecuentes', support: 'Soporte', policy: 'Política' } satisfies Record<DocSectionType, string>,
  audienceLabel: { 'end-user': 'Personal operativo', admin: 'Administración', support: 'Soporte' } satisfies Record<Audience, string>,
  manualTitle: (audience: ManualAudience, app: string) => audience === 'admin' ? `Manual de administración · ${app}` : `Manual operativo · ${app}`,
  manualSubtitle: (audience: ManualAudience, client: string) => audience === 'admin' ? `Guía completa para administrar ${client}` : `Guía de trabajo diario para el equipo de ${client}`,
}
