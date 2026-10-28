import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { configureNativeShell } from './lib/nativeShell'
import App from './App.tsx'
import { LocalUserProvider } from './contexts/LocalUserContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { bootAppUserStore } from './lib/app-user-store'
import { deferDbOpen } from './lib/db'
import { VaultGate } from './components/VaultGate'

function showBootError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 1.5rem; color: #1a1a1a;">
      <h1 style="font-size: 1.25rem; margin: 0 0 0.75rem;">Duckrep failed to start</h1>
      <p style="margin: 0 0 1rem; color: #555; line-height: 1.5;">
        The app store could not be initialized. Try refreshing the page.
        If this keeps happening, clear site data for this origin or restore from a journal export.
      </p>
      <pre style="white-space: pre-wrap; word-break: break-word; background: #f4f4f4; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.8rem;">${message.replace(/</g, '&lt;')}</pre>
    </div>
  `
}

/**
 * Resolves once the page has painted its main content: on the first
 * largest-contentful-paint entry where the browser reports it (capped at
 * 500 ms), else after one frame.
 */
function afterFirstPaint(): Promise<void> {
  return new Promise((resolve) => {
    const nextFrame = () => requestAnimationFrame(() => setTimeout(resolve, 0))
    if (
      typeof PerformanceObserver === 'undefined' ||
      !PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')
    ) {
      nextFrame()
      return
    }
    const timer = setTimeout(resolve, 500)
    const observer = new PerformanceObserver(() => {
      observer.disconnect()
      clearTimeout(timer)
      setTimeout(resolve, 0)
    })
    observer.observe({ type: 'largest-contentful-paint', buffered: true })
  })
}

async function boot() {
  await configureNativeShell()
  await bootAppUserStore()
  await import('./i18n')
  // Queries call getDb() on mount; let the page paint before the database
  // (sql.js + wasm + exercise seed) starts loading.
  deferDbOpen(afterFirstPaint())
  const root = createRoot(document.getElementById('root')!)
  root.render(
    <StrictMode>
      <ThemeProvider>
        <VaultGate>
          <LocalUserProvider>
            <App />
          </LocalUserProvider>
        </VaultGate>
      </ThemeProvider>
    </StrictMode>,
  )
}

void boot().catch((err) => {
  console.error('[duckrep] boot failed', err)
  showBootError(err)
})
