'use client'

import { RotateCcw } from 'lucide-react'

import { Button, Field, Input } from '@/shared/ui'

import { FormSelect, type FormSelectOption } from './FormSelect'
import { FilterPanel } from './FilterPanel'

export function OperationalFilters({ query, onQueryChange, queryLabel = 'Cliente', queryPlaceholder = 'Buscar cliente', showQuery = true, status, onStatusChange, statusOptions, dateFrom, onDateFromChange, dateTo, onDateToChange, onClear, resultCount, embedded = false, showClear = true }: { query: string; onQueryChange: (value: string) => void; queryLabel?: string; queryPlaceholder?: string; showQuery?: boolean; status: string; onStatusChange: (value: string) => void; statusOptions: FormSelectOption[]; dateFrom: string; onDateFromChange: (value: string) => void; dateTo: string; onDateToChange: (value: string) => void; onClear: () => void; resultCount: number; embedded?: boolean; showClear?: boolean }) {
  const fields = <div className="grid gap-3.5 sm:grid-cols-2">
      {showQuery ? <Field label={queryLabel}><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={queryPlaceholder} /></Field> : null}
      <Field label="Estado"><FormSelect ariaLabel="Filtrar por estado" value={status} onValueChange={onStatusChange} options={statusOptions} /></Field>
      <Field label="Desde"><Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => onDateFromChange(event.target.value)} /></Field>
      <Field label="Hasta"><Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => onDateToChange(event.target.value)} /></Field>
    </div>
  if (embedded) return <section aria-label="Filtros">{fields}{showClear ? <Button variant="secondary" icon={RotateCcw} onClick={onClear} className="mt-4">Limpiar</Button> : null}</section>
  const activeFilterCount = Number(Boolean(query.trim()) && showQuery) + Number(status !== 'all') + Number(Boolean(dateFrom)) + Number(Boolean(dateTo))
  return <FilterPanel title="Filtrar resultados" eyebrow="Filtros" activeFilterCount={activeFilterCount} resultCount={resultCount} onClear={onClear}>{fields}</FilterPanel>
}
