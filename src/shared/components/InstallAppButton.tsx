'use client'

import { Download, EllipsisVertical, Share, Smartphone, SquarePlus, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { promptInstall, useInstallMode, type InstallMode } from '@/shared/hooks/use-install-mode'
import { Button, Dialog } from '@/shared/ui'

type Step = { icon: LucideIcon; text: string }

const guides: Record<Exclude<InstallMode, 'unknown' | 'installed' | 'prompt'>, { description: string; steps: Step[]; note: string }> = {
  ios: {
    description: 'En iPhone y iPad se instala desde el menú Compartir.',
    steps: [
      { icon: Share, text: 'Toca el botón Compartir: el cuadrado con la flecha hacia arriba (abajo en Safari, arriba en Chrome).' },
      { icon: SquarePlus, text: 'Busca y toca “Agregar a inicio” o “Añadir a la pantalla de inicio”. Si no la ves, desliza la lista hacia abajo.' },
      { icon: Smartphone, text: 'Toca “Agregar”. LensSpace aparecerá en tu pantalla como cualquier otra app.' },
    ],
    note: 'Si no aparece la opción, abre esta página en Safari y repite los pasos.',
  },
  'mac-safari': {
    description: 'En Safari para Mac se instala desde el menú Archivo.',
    steps: [
      { icon: Share, text: 'En la barra de menú, abre “Archivo”, o toca el botón Compartir de Safari.' },
      { icon: SquarePlus, text: 'Elige “Agregar al Dock” y confirma con “Agregar”.' },
      { icon: Smartphone, text: 'LensSpace quedará en el Dock y en Aplicaciones.' },
    ],
    note: 'Necesitas macOS Sonoma o más reciente. Si no ves la opción, usa Chrome o Edge.',
  },
  manual: {
    description: 'Tu navegador todavía no mostró su ventana de instalación. Hazlo desde su menú.',
    steps: [
      { icon: EllipsisVertical, text: 'Abre el menú del navegador: los tres puntos, arriba a la derecha.' },
      { icon: Download, text: 'Toca “Instalar aplicación”, “Instalar LensSpace” o “Agregar a la pantalla de inicio”.' },
      { icon: Smartphone, text: 'Confirma. LensSpace aparecerá con su propio ícono.' },
    ],
    note: 'Si ya la instalaste, búscala entre tus aplicaciones. Si tu navegador no tiene esa opción, abre LensSpace en Chrome o Edge.',
  },
}

// Installs the PWA in one tap where the browser allows it; elsewhere it explains
// the two or three taps the user needs. Hidden once the app runs installed.
export function InstallAppButton({ className, label = 'Instalar app' }: { className: string; label?: string }) {
  const mode = useInstallMode()
  const [helpOpen, setHelpOpen] = useState(false)
  if (mode === 'unknown' || mode === 'installed') return null
  const guide = mode === 'prompt' ? null : guides[mode]

  return (
    <>
      <button type="button" className={className} onClick={() => (mode === 'prompt' ? void promptInstall() : setHelpOpen(true))}>
        <Download aria-hidden="true" size={18} className="shrink-0" />
        {label}
      </button>
      {guide ? (
        <Dialog
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          icon={Download}
          title="Instalar LensSpace"
          description={guide.description}
          footer={<Button onClick={() => setHelpOpen(false)}>Entendido</Button>}
        >
          <ol className="space-y-3">
            {guide.steps.map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-action-soft text-action">
                  <Icon aria-hidden="true" size={18} />
                </span>
                <p className="pt-1.5 text-[15px] leading-[1.5] text-text"><span className="font-semibold text-ink">{index + 1}.</span> {text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm leading-[1.5] text-text-secondary">{guide.note}</p>
        </Dialog>
      ) : null}
    </>
  )
}
