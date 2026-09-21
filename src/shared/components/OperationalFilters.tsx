'use client'

import { FormSelect, type FormSelectOption } from './FormSelect'
import { FilterPanel } from './FilterPanel'

const fieldClass = 'w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'

export function OperationalFilters({ query, onQueryChange, queryLabel = 'Cliente', queryPlaceholder = 'Buscar cliente', showQuery = true, status, onStatusChange, statusOptions, dateFrom, onDateFromChange, dateTo, onDateToChange, onClear, resultCount, embedded = false, showClear = true }: { query: string; onQueryChange: (value: string) => void; queryLabel?: string; queryPlaceholder?: string; showQuery?: boolean; status: string; onStatusChange: (value: string) => void; statusOptions: FormSelectOption[]; dateFrom: string; onDateFromChange: (value: string) => void; dateTo: string; onDateToChange: (value: string) => void; onClear: () => void; resultCount: number; embedded?: boolean; showClear?: boolean }) {
  const fields = <div className="grid gap-3 md:grid-cols-2">
      {showQuery ? <label className="text-xs font-semibold text-[#4A5B58]">{queryLabel}<input className={`${fieldClass} mt-1`} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={queryPlaceholder} /></label> : null}
      <label className="text-xs font-semibold text-[#4A5B58]">Estado<FormSelect className="mt-1" ariaLabel="Filtrar por estado" value={status} onValueChange={onStatusChange} options={statusOptions} /></label>
      <label className="text-xs font-semibold text-[#4A5B58]">Desde<input className={`${fieldClass} mt-1`} type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => onDateFromChange(event.target.value)} /></label>
      <label className="text-xs font-semibold text-[#4A5B58]">Hasta<input className={`${fieldClass} mt-1`} type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => onDateToChange(event.target.value)} /></label>
    </div>
  if (embedded) return <section aria-label="Filtros">{fields}{showClear ? <button type="button" onClick={onClear} className="mt-4 rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58] hover:bg-[#F7FBFA]">Limpiar</button> : null}</section>
  const activeFilterCount = Number(Boolean(query.trim()) && showQuery) + Number(status !== 'all') + Number(Boolean(dateFrom)) + Number(Boolean(dateTo))
  return <FilterPanel title="Filtrar resultados" eyebrow="Filtros" activeFilterCount={activeFilterCount} resultCount={resultCount} onClear={onClear}>{fields}</FilterPanel>
}
