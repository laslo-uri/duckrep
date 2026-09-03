import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LocalUserProvider } from './contexts/LocalUserContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { bootAppUserStore } from './lib/app-user-store'
import { initDb } from './lib/db'

function showBootError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 1.5rem; color: #1a1a1a;">
      <h1 style="font-size: 1.25rem; margin: 0 0 0.75rem;">YouPeak failed to start</h1>
      <p style="margin: 0 0 1rem; color: #555; line-height: 1.5;">
        The local database or app store could not be initialized. Try refreshing the page.
        If this keeps happening, clear site data for this origin or restore from a journal export.
      </p>
      <pre style="white-space: pre-wrap; word-break: break-word; background: #f4f4f4; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.8rem;">${message.replace(/</g, '&lt;')}</pre>
    </div>
  `
}

async function boot() {
  await bootAppUserStore()
  await initDb()
  await import('./i18n')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <LocalUserProvider>
          <App />
        </LocalUserProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}

void boot().catch((err) => {
  console.error('[youpeak] boot failed', err)
  showBootError(err)
})
