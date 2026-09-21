export type Audience = 'end-user' | 'admin' | 'support'
export type ManualAudience = 'worker' | 'admin'
export type ManualLocale = 'es'
export type DocSectionType = 'overview' | 'access' | 'roles' | 'module' | 'workflow' | 'faq' | 'support' | 'policy'

export interface ClientDocsRole { name: string; description: string; permissions: string[] }
export interface ClientDocsModule {
  name: string
  description: string
  endUserActions: string[]
  adminActions?: string[]
  audience?: ManualAudience
  image?: { src: string; alt: string }
}
export interface ClientDocsWorkflow { title: string; audience: Audience; steps: string[] }
export interface ClientDocsFaq { question: string; answer: string }
export interface ClientDocsInput {
  appName: string
  clientName: string
  appUrl: string
  supportEmail?: string
  supportHours?: string
  primaryAdminEmail?: string
  modules: ClientDocsModule[]
  roles: ClientDocsRole[]
  workflows: ClientDocsWorkflow[]
  faqs: ClientDocsFaq[]
  policies?: string[]
}
export interface DocSection { id: string; title: string; type: DocSectionType; content: string }
export interface GeneratedClientDocs {
  title: string
  subtitle: string
  audience: ManualAudience
  locale: ManualLocale
  generatedAt: string
  sections: DocSection[]
}
