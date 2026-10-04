import { COPY } from './copy'
import type { ClientDocsInput, DocSection, GeneratedClientDocs, ManualAudience } from './types'

const slugify = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const bullets = (items: string[]) => items.length ? items.map((item) => `- ${item}`).join('\n') : '- No hay elementos configurados.'
const steps = (items: string[]) => items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : '1. No hay pasos configurados.'

// Fixed plain-language copy (Cuban Spanish) shared by every manual variant.
const ORDER_JOURNEY = ['El cliente llega y se le busca o se le crea su ficha.', 'Se copia su receta.', 'Se escogen los espejuelos y se le dice el precio.', 'El cliente acepta y, si quiere, deja dinero adelantado.', 'El laboratorio hace los cristales y el montador los monta.', 'La óptica los revisa y le avisa al cliente por WhatsApp.', 'El cliente paga lo que falta y se lleva sus espejuelos.']
const GLOSSARY = ['Cotización: el precio que le das al cliente antes de que diga que sí.', 'Pedido: la venta que el cliente ya aceptó.', 'Saldo: lo que el cliente todavía debe.', 'Tasa: cuántos CUP vale 1 USD ese día.', 'Incidencia: cuando un trabajo sale mal y hay que repetirlo.', 'OD y OI: ojo derecho y ojo izquierdo.']
const FIRST_ACCESS = ['El dueño te manda una invitación a tu correo.', 'Abre el correo y toca el enlace.', 'Inventa una contraseña, escríbela dos veces y toca «Guardar contraseña».', 'Ya estás dentro.']
const FORGOT_PASSWORD = ['En la pantalla de entrar, toca «¿Olvidaste tu contraseña?».', 'Escribe tu correo y toca «Enviar enlace».', 'Abre el correo y crea una contraseña nueva.']
const ACCOUNT_SAFETY = ['No le digas tu contraseña a nadie, ni a un compañero.', 'Si usas una computadora que no es tuya, sal del sistema al terminar.', 'Si alguien deja de trabajar en la óptica, pídele al dueño que le quite el acceso ese mismo día.']

export function generateClientDocs(input: ClientDocsInput, audience: ManualAudience = 'worker'): GeneratedClientDocs {
  const modules = input.modules.filter((module) => audience === 'admin' || (module.audience !== 'admin' && module.endUserActions.length > 0))
  const login = [`Abre el navegador y escribe ${input.appUrl}/login`, 'Escribe tu correo.', 'Escribe tu contraseña.', 'Toca «Iniciar sesión».', 'Vas a ver solo las partes que te tocan según tu trabajo.']
  const sections: DocSection[] = [
    { id: 'overview', title: COPY.sectionTitle.overview, type: 'overview', content: `# Bienvenido a ${input.appName}\n\n${input.appName} es el programa donde la óptica anota todo su trabajo: los clientes, sus recetas, las ventas, los cobros, el trabajo del laboratorio y la entrega de los espejuelos. Así nada se pierde en una libreta y todos saben en qué va cada pedido.\n\n## El camino de un pedido\n\n${steps(ORDER_JOURNEY)}\n\n## Palabras que vas a ver\n\n${bullets(GLOSSARY)}\n\n## Qué hay en esta guía\n\n${bullets(modules.map((module) => module.name))}\n\n## Dónde se entra\n\n- Dirección: ${input.appUrl}\n- Funciona en la computadora y en el teléfono, desde el navegador (Chrome, por ejemplo). No hay que instalar nada.` },
    { id: 'access', title: COPY.sectionTitle.access, type: 'access', content: `# ${COPY.sectionTitle.access}\n\n![Pantalla para entrar: arriba el correo y abajo la contraseña](/manual/login.png)\n\n## La primera vez\n\n${steps(FIRST_ACCESS)}\n\n## Los demás días\n\n${steps(login)}\n\n## Si se te olvidó la contraseña\n\n${steps(FORGOT_PASSWORD)}\n\n## Para cuidar tu cuenta\n\n${bullets(ACCOUNT_SAFETY)}` },
    { id: 'roles', title: COPY.sectionTitle.roles, type: 'roles', content: `# ${COPY.sectionTitle.roles}\n\n${input.roles.map((role) => `## ${role.name}\n\n${role.description}\n\n${bullets(role.permissions)}`).join('\n\n')}` },
    ...modules.map((module): DocSection => ({ id: `module-${slugify(module.name)}`, title: module.name, type: 'module', content: `# ${module.name}\n${module.image ? `\n![${module.image.alt}](${module.image.src})\n` : ''}\n${module.description}\n\n${module.endUserActions.length ? `## Cómo se hace\n\n${bullets(module.endUserActions)}` : ''}${audience === 'admin' && module.adminActions?.length ? `\n\n## Para el dueño\n\n${bullets(module.adminActions)}` : ''}` })),
    ...input.workflows.filter((workflow) => audience === 'admin' || workflow.audience === 'end-user').map((workflow): DocSection => ({ id: `workflow-${slugify(workflow.title)}`, title: `Paso a paso: ${workflow.title}`, type: 'workflow', content: `# ${workflow.title}\n\nPara: ${COPY.audienceLabel[workflow.audience]}\n\n${steps(workflow.steps)}` })),
    { id: 'faq', title: COPY.sectionTitle.faq, type: 'faq', content: `# ${COPY.sectionTitle.faq}\n\n${input.faqs.map((faq) => `## ${faq.question}\n\n${faq.answer}`).join('\n\n')}` },
    ...(input.policies?.length ? [{ id: 'policies', title: COPY.sectionTitle.policy, type: 'policy' as const, content: `# ${COPY.sectionTitle.policy}\n\n${bullets(input.policies)}` }] : []),
  ]
  return { title: COPY.manualTitle(audience, input.appName), subtitle: COPY.manualSubtitle(audience, input.clientName), audience, locale: 'es', generatedAt: new Date().toISOString(), sections }
}
