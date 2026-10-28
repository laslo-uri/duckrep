/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { userStorePlugin } from './user-store/vite-plugin.js'
import { handleMuscleWiki } from './api/musclewiki.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string }

const appVersionDefine = {
  __APP_VERSION__: JSON.stringify(pkg.version),
}

/** Mounts api/musclewiki.ts on the dev and preview servers; the key stays in Node (no VITE_ prefix). */
function muscleWikiProxy(key: string | undefined): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/musclewiki')) return next()
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(name, value)
    }
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, { method: req.method, headers })
    handleMuscleWiki(request, key)
      .then((response) => {
        res.statusCode = response.status
        response.headers.forEach((value, name) => res.setHeader(name, value))
        if (response.body) Readable.fromWeb(response.body as NodeReadableStream).pipe(res)
        else res.end()
      })
      .catch(next)
  }
  return {
    name: 'duckrep-musclewiki-proxy',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    userStorePlugin({ appId: 'com.duckrep.app' }),
    muscleWikiProxy(loadEnv(mode, __dirname, '').MUSCLEWIKI_API_KEY),
    react(),
    tailwindcss(),
  ],
  define: appVersionDefine,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('sql.js')) return 'sql'
          if (id.includes('@tanstack/react-query')) return 'query'
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n'
          if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react-vendor'
          }
          if (id.includes('lucide-react')) return 'icons'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.test.ts'],
    css: true,
  },
}))
