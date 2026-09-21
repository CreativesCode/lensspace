import { FormSelect } from '@/shared/components'

export function PrescriptionFormFields({ fieldClass }: { fieldClass: string }) {
  const compactClass = fieldClass.replace('mt-1 ', '')

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] border-collapse">
          <thead><tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[#74857F]"><th className="p-2" /><th className="p-2">Esfera</th><th className="p-2">Cilindro</th><th className="p-2">Eje</th><th className="p-2">Adición</th><th className="p-2">DP</th><th className="p-2">Altura</th></tr></thead>
          <tbody>
            {(['right', 'left'] as const).map((eye) => (
              <tr key={eye}>
                <th className="p-2 font-display text-sm text-[#07322F]">{eye === 'right' ? 'OD' : 'OI'}</th>
                <td className="p-2"><input aria-label={`${eye} esfera`} className={compactClass} name={`${eye}Sphere`} type="number" min="-40" max="40" step="0.25" /></td>
                <td className="p-2"><input aria-label={`${eye} cilindro`} className={compactClass} name={`${eye}Cylinder`} type="number" min="-20" max="20" step="0.25" /></td>
                <td className="p-2"><input aria-label={`${eye} eje`} className={compactClass} name={`${eye}Axis`} type="number" min="0" max="180" step="1" /></td>
                <td className="p-2"><input aria-label={`${eye} adición`} className={compactClass} name={`${eye}Addition`} type="number" min="0" max="8" step="0.25" /></td>
                <td className="p-2"><input aria-label={`${eye} distancia pupilar`} className={compactClass} name={`${eye}PupillaryDistance`} type="number" min="15" max="50" step="0.5" /></td>
                <td className="p-2"><input aria-label={`${eye} altura`} className={compactClass} name={`${eye}Height`} type="number" min="0" max="60" step="0.5" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-medium text-[#4A5B58]">DP conjunta<input className={fieldClass} name="pupillaryDistanceTotal" type="number" min="30" max="90" step="0.5" /></label>
        {(['right', 'left'] as const).map((eye) => (
          <div key={eye} className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-[#4A5B58]">Prisma {eye === 'right' ? 'OD' : 'OI'}<input className={fieldClass} name={`${eye}Prism`} type="number" min="0" max="20" step="0.25" /></label>
            <label className="text-xs font-medium text-[#4A5B58]">Base<FormSelect className="mt-1" name={`${eye}PrismBase`} ariaLabel={`Base del prisma ${eye === 'right' ? 'OD' : 'OI'}`} options={[{ value: '', label: 'Sin base' }, { value: 'up', label: 'Arriba' }, { value: 'down', label: 'Abajo' }, { value: 'in', label: 'Interna' }, { value: 'out', label: 'Externa' }]} /></label>
          </div>
        ))}
        <label className="text-xs font-medium text-[#4A5B58]">Fecha de la receta<input className={fieldClass} name="prescriptionDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label className="text-xs font-medium text-[#4A5B58] md:col-span-2">Médico u optometrista<input className={fieldClass} name="prescriberName" minLength={2} maxLength={160} /></label>
        <label className="text-xs font-medium text-[#4A5B58] md:col-span-2 lg:col-span-3">Observaciones<textarea className={fieldClass} name="notes" rows={3} /></label>
      </div>

      <label className="block rounded-lg border border-dashed border-[#B9DFD9] bg-[#F7FDFC] p-4 text-sm text-[#4A5B58]">
        Original privado <span className="text-xs text-[#74857F]">(opcional, máx. 10 MB)</span>
        <input className="mt-2 block w-full text-xs" name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
      </label>
    </>
  )
}
