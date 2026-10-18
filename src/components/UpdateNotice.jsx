import { useEffect, useState } from 'react'

const FALLBACK_NOTES = [
  '✨ Mejoras visuales y de comodidad en el uso diario',
  '⚡ Mayor rapidez al usar la agenda, clientas y contabilidad',
]

export default function UpdateNotice() {
  const [availableVersion, setAvailableVersion] = useState(null)
  const [updateNotes, setUpdateNotes] = useState(FALLBACK_NOTES)
  const [dismissedVersion, setDismissedVersion] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    let stopped = false
    let pending = false
    let activeController
    const check = async () => {
      if (document.visibilityState === 'hidden' || pending) return
      pending = true
      activeController = new AbortController()
      const timeout = setTimeout(() => activeController.abort(), 10000)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
          cache: 'no-store', signal: activeController.signal,
        })
        if (!response.ok) return
        const version = await response.json()
        if (!stopped && typeof version.id === 'string' && version.id && version.id !== __APP_BUILD_ID__) {
          setAvailableVersion(version.id)
          if (Array.isArray(version.notes) && version.notes.length > 0) {
            setUpdateNotes(version.notes.slice(0, 4))
          }
        }
      } catch {
        // Sin conexión o durante un despliegue, conservar la sesión actual.
      } finally {
        clearTimeout(timeout)
        pending = false
      }
    }
    check()
    const interval = setInterval(check, 60000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      stopped = true
      activeController?.abort()
      clearInterval(interval)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  if (!availableVersion || availableVersion === dismissedVersion) return null
  return (
    <aside className="update-notice" role="status" aria-live="polite">
      <div>
        <strong>🌿 Nueva versión disponible</strong>
        <p>Terminá lo que estás cargando y actualizá para disfrutar las últimas mejoras.</p>
      </div>

      {showDetails && (
        <div className="update-notice-details">
          <div className="update-notice-details-title">✨ ¿Qué trae de nuevo?</div>
          <ul className="update-notice-details-list">
            {updateNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
          <div className="update-notice-details-safe">
            🔒 Tus turnos y datos cargados se mantienen intactos.
          </div>
        </div>
      )}

      <div className="update-notice-actions">
        <button
          type="button"
          className="update-notice-details-btn"
          onClick={() => setShowDetails(prev => !prev)}
        >
          {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
        </button>
        <div className="update-notice-actions-right">
          <button type="button" onClick={() => setDismissedVersion(availableVersion)}>Más tarde</button>
          <button type="button" className="update-notice-primary" onClick={() => window.location.reload()}>Actualizar</button>
        </div>
      </div>
    </aside>
  )
}
