import { COPY } from './copy'
import type { ClientDocsInput, DocSection, GeneratedClientDocs, ManualAudience } from './types'

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const bullets = (items: string[]) => items.length ? items.map((item) => `- ${item}`).join('\n') : '- No hay elementos configurados.'
const steps = (items: string[]) => items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No hay pasos configurados.'

export function generateClientDocs(input: ClientDocsInput, audience: ManualAudience = 'worker'): GeneratedClientDocs {
  const modules = input.modules.filter((module) => audience === 'admin' || (module.audience !== 'admin' && module.endUserActions.length > 0))
  const sections: DocSection[] = [
    { id: 'overview', title: COPY.sectionTitle.overview, type: 'overview', content: `# ${input.appName}\n\nLensSpace centraliza el recorrido completo de una óptica: desde la ficha del cliente y la receta hasta el cobro, la producción y la entrega.\n\n## Qué encontrarás en este manual\n\n${bullets(modules.map((module) => `${module.name}: ${module.description}`))}\n\n## Dirección de acceso\n\n- URL: ${input.appUrl}` },
    { id: 'access', title: COPY.sectionTitle.access, type: 'access', content: `# ${COPY.sectionTitle.access}\n\n![Pantalla de acceso seguro de LensSpace](/manual/login.png)\n\n## Entrar a LensSpace\n\n${steps([`Abre ${input.appUrl}/login en un navegador moderno.`, 'Introduce el correo de la cuenta invitada.', 'Introduce tu contraseña.', 'Pulsa «Entrar».', 'Comprueba que el menú muestre solamente las áreas correspondientes a tu rol.'])}\n\n## Primer acceso por invitación\n\n${steps(['Abre el enlace de invitación recibido por correo.', 'Escribe una contraseña segura y confírmala.', 'Pulsa «Guardar contraseña».', 'Espera la redirección al panel principal.'])}\n\n## Seguridad\n\n${bullets(['No compartas tu cuenta ni tu contraseña.', 'Cierra la sesión al terminar en un equipo compartido.', 'Solicita al dueño que desactive inmediatamente accesos que ya no correspondan.'])}` },
    { id: 'roles', title: COPY.sectionTitle.roles, type: 'roles', content: `# ${COPY.sectionTitle.roles}\n\n${input.roles.map((role) => `## ${role.name}\n\n${role.description}\n\n${bullets(role.permissions)}`).join('\n\n')}` },
    ...modules.map((module): DocSection => ({ id: `module-${slugify(module.name)}`, title: `Módulo: ${module.name}`, type: 'module', content: `# ${module.name}\n${module.image ? `\n![${module.image.alt}](${module.image.src})\n` : ''}\n${module.description}\n\n${module.endUserActions.length ? `## Acciones operativas\n\n${bullets(module.endUserActions)}` : ''}${audience === 'admin' && module.adminActions?.length ? `\n\n## Acciones administrativas\n\n${bullets(module.adminActions)}` : ''}` })),
    ...input.workflows.filter((workflow) => audience === 'admin' || workflow.audience === 'end-user').map((workflow): DocSection => ({ id: `workflow-${slugify(workflow.title)}`, title: `Flujo: ${workflow.title}`, type: 'workflow', content: `# ${workflow.title}\n\nDirigido a: ${COPY.audienceLabel[workflow.audience]}\n\n${steps(workflow.steps)}` })),
    { id: 'faq', title: COPY.sectionTitle.faq, type: 'faq', content: `# ${COPY.sectionTitle.faq}\n\n${input.faqs.map((faq) => `## ${faq.question}\n\n${faq.answer}`).join('\n\n')}` },
    ...(input.policies?.length ? [{ id: 'policies', title: COPY.sectionTitle.policy, type: 'policy' as const, content: `# ${COPY.sectionTitle.policy}\n\n${bullets(input.policies)}` }] : []),
  ]
  return { title: COPY.manualTitle(audience, input.appName), subtitle: COPY.manualSubtitle(audience, input.clientName), audience, locale: 'es', generatedAt: new Date().toISOString(), sections }
}
