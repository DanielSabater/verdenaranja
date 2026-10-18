import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

const buildId = new Date().toISOString()

function toFriendlyUpdateNote(rawSubject) {
  const clean = String(rawSubject || '')
    .replace(/^(feat|fix|chore|refactor|style|perf|docs)(\([^)]*\))?:\s*/i, '')
    .trim()
  if (!clean) return null

  const lower = clean.toLowerCase()
  let icon = '✨'
  if (lower.includes('client')) icon = '👥'
  else if (lower.includes('contabilidad') || lower.includes('gráfico') || lower.includes('grafico') || lower.includes('factur')) icon = '📊'
  else if (lower.includes('optimiz') || lower.includes('rápid') || lower.includes('veloci')) icon = '⚡'
  else if (lower.includes('turno') || lower.includes('agenda') || lower.includes('horario')) icon = '📅'
  else if (lower.includes('whatsapp') || lower.includes('mensaje') || lower.includes('alerta')) icon = '💬'

  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1)
  return `${icon} ${capitalized}`
}

function getBuildReleaseNotes() {
  try {
    const raw = execSync('git log -n 3 --no-merges --pretty=format:"%s"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const notes = raw
      .split('\n')
      .map(toFriendlyUpdateNote)
      .filter(Boolean)
    if (notes.length > 0) return notes
  } catch {
    // Fallback si git no está disponible en el entorno de build
  }
  return [
    '✨ Mejoras visuales y de comodidad en el uso diario',
    '⚡ Mayor rapidez y fluidez al navegar por la agenda y clientas',
  ]
}

const buildNotes = getBuildReleaseNotes()

export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), {
    name: 'app-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ id: buildId, notes: buildNotes }),
      })
    },
  }],
  css: { postcss: {} },
})
