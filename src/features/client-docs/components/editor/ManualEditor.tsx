'use client'

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { FormSelect } from '@/shared/components'
import { Button, Field, IconButton, Input, Textarea, cx } from '@/shared/ui'
import type { ClientDocsFaq, ClientDocsInput, ClientDocsModule, ClientDocsRole, ClientDocsWorkflow } from '../../generators/types'
import { moveBy, removeAt, replaceAt } from './listOps'

const Text = ({ label, value, onChange, area = false }: { label: string; value: string; onChange: (value: string) => void; area?: boolean }) => <Field label={label}>{area ? <Textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} /> : <Input value={value} onChange={(event) => onChange(event.target.value)} />}</Field>
const Lines = ({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) => <Text label={label} area value={value.join('\n')} onChange={(next) => onChange(next.split('\n').filter(Boolean))} />
const EditorSection = ({ title, action, children }: { title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) => <section className="rounded-card border border-line-card bg-surface"><header className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-2"><h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>{action}</header><div className="flex flex-col gap-3 p-3">{children}</div></section>

function ListEditor<T extends object>({ title, items, onChange, makeEmpty, itemTitle, render }: { title: string; items: T[]; onChange: (items: T[]) => void; makeEmpty: () => T; itemTitle: (item: T, index: number) => string; render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode }) {
  const counter = useRef(0)
  const [keys, setKeys] = useState(() => items.map((_, index) => `manual-initial-${index}`))
  const [openKey, setOpenKey] = useState<string | null>(null)
  const add = () => { const key = `manual-item-${counter.current++}`; setKeys([...keys, key]); onChange([...items, makeEmpty()]); setOpenKey(key) }
  const apply = (nextItems: T[], nextKeys: string[]) => { onChange(nextItems); setKeys(nextKeys) }
  return <EditorSection title={<>{title} <span className="font-sans text-[13px] font-normal text-text-muted">({items.length})</span></>} action={<Button size="sm" icon={Plus} onClick={add}>Añadir</Button>}>
    {items.map((item, index) => {
      const key = keys[index] ?? `fallback-${index}`
      const open = openKey === key
      return <div key={key} className={cx('rounded-control border', open ? 'border-action' : 'border-line-card')}>
        <div className="flex items-center gap-1 p-1">
          <button type="button" aria-expanded={open} onClick={() => setOpenKey(open ? null : key)} className="min-h-11 min-w-0 flex-1 truncate rounded-control px-2.5 text-left text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">{itemTitle(item, index) || 'Sin título'}</button>
          <IconButton icon={ChevronUp} label="Mover arriba" disabled={!index} onClick={() => apply(moveBy(items, index, -1), moveBy(keys, index, -1))} variant="ghost" />
          <IconButton icon={ChevronDown} label="Mover abajo" disabled={index === items.length - 1} onClick={() => apply(moveBy(items, index, 1), moveBy(keys, index, 1))} variant="ghost" />
          <IconButton icon={Trash2} label="Eliminar" onClick={() => apply(removeAt(items, index), removeAt(keys, index))} variant="danger" />
        </div>
        {open ? <div className="flex flex-col gap-3 border-t border-line p-3">{render(item, (patch) => onChange(replaceAt(items, index, { ...item, ...patch })))}</div> : null}
      </div>
    })}
  </EditorSection>
}

export function ManualEditor({ input, onChange }: { input: ClientDocsInput; onChange: (input: ClientDocsInput) => void }) {
  const set = <K extends keyof ClientDocsInput>(key: K, value: ClientDocsInput[K]) => onChange({ ...input, [key]: value })
  return <div className="flex flex-col gap-3 overflow-y-auto bg-canvas p-3">
    <EditorSection title="Datos generales"><Text label="Nombre de la aplicación" value={input.appName} onChange={(value) => set('appName', value)} /><Text label="Cliente o audiencia" value={input.clientName} onChange={(value) => set('clientName', value)} /><Text label="URL" value={input.appUrl} onChange={(value) => set('appUrl', value)} /></EditorSection>
    <ListEditor<ClientDocsModule> title="Módulos" items={input.modules} onChange={(value) => set('modules', value)} makeEmpty={() => ({ name: '', description: '', endUserActions: [] })} itemTitle={(item) => item.name} render={(item, update) => <><Text label="Nombre" value={item.name} onChange={(name) => update({ name })} /><Text label="Descripción" area value={item.description} onChange={(description) => update({ description })} /><Lines label="Acciones operativas (una por línea)" value={item.endUserActions} onChange={(endUserActions) => update({ endUserActions })} /><Lines label="Acciones administrativas (una por línea)" value={item.adminActions ?? []} onChange={(adminActions) => update({ adminActions })} /></>} />
    <ListEditor<ClientDocsRole> title="Roles" items={input.roles} onChange={(value) => set('roles', value)} makeEmpty={() => ({ name: '', description: '', permissions: [] })} itemTitle={(item) => item.name} render={(item, update) => <><Text label="Nombre" value={item.name} onChange={(name) => update({ name })} /><Text label="Descripción" area value={item.description} onChange={(description) => update({ description })} /><Lines label="Permisos (uno por línea)" value={item.permissions} onChange={(permissions) => update({ permissions })} /></>} />
    <ListEditor<ClientDocsWorkflow> title="Flujos" items={input.workflows} onChange={(value) => set('workflows', value)} makeEmpty={() => ({ title: '', audience: 'end-user', steps: [] })} itemTitle={(item) => item.title} render={(item, update) => <><Text label="Título" value={item.title} onChange={(title) => update({ title })} /><Field label="Audiencia"><FormSelect ariaLabel="Audiencia" value={item.audience} onValueChange={(value) => update({ audience: value as ClientDocsWorkflow['audience'] })} options={[{ value: 'end-user', label: 'Personal operativo' }, { value: 'admin', label: 'Administración' }, { value: 'support', label: 'Soporte' }]} /></Field><Lines label="Pasos (uno por línea)" value={item.steps} onChange={(steps) => update({ steps })} /></>} />
    <ListEditor<ClientDocsFaq> title="Preguntas frecuentes" items={input.faqs} onChange={(value) => set('faqs', value)} makeEmpty={() => ({ question: '', answer: '' })} itemTitle={(item) => item.question} render={(item, update) => <><Text label="Pregunta" value={item.question} onChange={(question) => update({ question })} /><Text label="Respuesta" area value={item.answer} onChange={(answer) => update({ answer })} /></>} />
    <EditorSection title="Políticas"><Lines label="Políticas (una por línea)" value={input.policies ?? []} onChange={(policies) => set('policies', policies)} /></EditorSection>
  </div>
}
