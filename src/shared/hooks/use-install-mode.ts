'use client'

import { useSyncExternalStore } from 'react'

import { INSTALL_CHANGE_EVENT } from '@/shared/lib/pwa-install'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    __lensspaceInstallPrompt?: BeforeInstallPromptEvent | null
    __lensspaceInstalled?: boolean
  }
}

// prompt: the browser offers its native install dialog (Chrome, Edge, Samsung).
// ios / mac-safari: no install API, the user follows Share → Add to Home Screen / Dock.
// manual: any other browser, or Chrome before it decides the app is installable.
export type InstallMode = 'unknown' | 'installed' | 'prompt' | 'ios' | 'mac-safari' | 'manual'

const STANDALONE_QUERY = '(display-mode: standalone)'

function getMode(): InstallMode {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone
  if (window.__lensspaceInstalled || iosStandalone || window.matchMedia(STANDALONE_QUERY).matches) return 'installed'
  if (window.__lensspaceInstallPrompt) return 'prompt'
  const ua = navigator.userAgent
  // iPadOS reports a Mac user agent; touch support tells them apart.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return 'mac-safari'
  return 'manual'
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(STANDALONE_QUERY)
  window.addEventListener(INSTALL_CHANGE_EVENT, onChange)
  media.addEventListener('change', onChange)
  return () => {
    window.removeEventListener(INSTALL_CHANGE_EVENT, onChange)
    media.removeEventListener('change', onChange)
  }
}

export function useInstallMode() {
  return useSyncExternalStore(subscribe, getMode, () => 'unknown' as const)
}

// Returns false when there was no native prompt or the user dismissed it.
export async function promptInstall() {
  const event = window.__lensspaceInstallPrompt
  if (!event) return false
  await event.prompt()
  const { outcome } = await event.userChoice
  // A prompt event works once; Chrome fires a new one later if it applies.
  window.__lensspaceInstallPrompt = null
  window.dispatchEvent(new Event(INSTALL_CHANGE_EVENT))
  return outcome === 'accepted'
}
