import { getCurrentWindow } from '@tauri-apps/api/window'
import { inDesktopShell } from '../lib/desktopShell'

type Command = 'minimize' | 'toggleMaximize' | 'close'

/**
 * The window caption a frameless desktop window draws itself, in the app's own colours. The same in every
 * bird app and in Rootsware: the name on the left (drag to move, double-click to maximize), three controls
 * on the right. Renders nothing in a browser.
 */
export function DesktopTitlebar({ title }: { title: string }) {
  if (!inDesktopShell()) return null
  const run = (command: Command) => () => void getCurrentWindow()[command]()
  return (
    <header className="desktop-titlebar">
      <div className="desktop-titlebar__drag" data-tauri-drag-region>
        <span className="desktop-titlebar__name" data-tauri-drag-region>
          {title}
        </span>
      </div>
      <div className="desktop-titlebar__controls">
        <button type="button" onClick={run('minimize')} aria-label="Minimize">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" onClick={run('toggleMaximize')} aria-label="Maximize">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        </button>
        <button type="button" onClick={run('close')} aria-label="Close" className="desktop-titlebar__close">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}
