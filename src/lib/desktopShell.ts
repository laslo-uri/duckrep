import { invoke } from '@tauri-apps/api/core'

/** The Tauri desktop shell (frameless, see tauri.conf.json); phone shells keep the system bars. */
export const inDesktopShell = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window && !/Android|iPhone|iPad/i.test(navigator.userAgent)

/** Marks <html> so the page leaves room for the caption (DesktopTitlebar). Call once before the first render. */
export function prepareDesktopShell() {
  if (inDesktopShell()) document.documentElement.classList.add('is-desktop')
}

let available: Promise<boolean> | undefined

/** Whether Rootsware, the family launcher, is built on this machine (asked once). Always false on the web. */
export function rootswareAvailable(): Promise<boolean> {
  if (!inDesktopShell()) return Promise.resolve(false)
  available ??= invoke<boolean>('rootsware_available').catch(() => false)
  return available
}

/** Opens Rootsware next to this app. */
export function openRootsware(): Promise<void> {
  return invoke('open_rootsware')
}
