import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { citationIndexPlugin } from './scripts/citationIndexPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), citationIndexPlugin()],
})
