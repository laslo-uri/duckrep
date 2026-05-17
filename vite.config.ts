/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')) as { version: string }

const appVersionDefine = {
  __APP_VERSION__: JSON.stringify(pkg.version),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: appVersionDefine,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: true,
  },
})
