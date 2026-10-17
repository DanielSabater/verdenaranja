import { useEffect, useState } from 'react'

export default function UpdateNotice() {
  const [availableVersion, setAvailableVersion] = useState(null)
  const [dismissedVersion, setDismissedVersion] = useState(null)

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
      <div><strong>🌿 Nueva versión disponible</strong><p>Terminá lo que estás cargando y actualizá.</p></div>
      <div className="update-notice-actions">
        <button type="button" onClick={() => setDismissedVersion(availableVersion)}>Más tarde</button>
        <button type="button" className="update-notice-primary" onClick={() => window.location.reload()}>Actualizar</button>
      </div>
    </aside>
  )
}
