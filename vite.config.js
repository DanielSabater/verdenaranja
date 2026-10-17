import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildId = new Date().toISOString()

export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), {
    name: 'app-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId }) })
    },
  }],
  css: { postcss: {} },
})
