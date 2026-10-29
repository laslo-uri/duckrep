import { invoke } from '@tauri-apps/api/core'

/** The Tauri desktop shell (frameless, see tauri.conf.json); phone shells keep the system bars. */
export const inDesktopShell = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window && !/Android|iPhone|iPad/i.test(navigator.userAgent)

/** Marks <html> so the page leaves room for the caption (DesktopTitlebar). Call once before the first render. */
export function prepareDesktopShell() {
  if (!inDesktopShell()) return
  document.documentElement.classList.add('is-desktop')
  // The webview has no tabs: links that would open a new tab go to the system browser.
  document.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null
    if (!link || !link.href.startsWith('https://')) return
    event.preventDefault()
    void invoke('open_external', { url: link.href })
  })
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
