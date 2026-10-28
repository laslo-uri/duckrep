/** The Tauri desktop shell (frameless, see tauri.conf.json); phone shells keep the system bars. */
export const inDesktopShell = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window && !/Android|iPhone|iPad/i.test(navigator.userAgent)

/** Marks <html> so the page leaves room for the caption (DesktopTitlebar). Call once before the first render. */
export function prepareDesktopShell() {
  if (inDesktopShell()) document.documentElement.classList.add('is-desktop')
}
