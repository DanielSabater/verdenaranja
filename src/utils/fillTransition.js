export const FILL_TRANSITION_MS = 400

// El bloqueo se activa antes del primer render para evitar acciones duplicadas.
export function createFillTransition({ onChange, schedule = setTimeout, cancel = clearTimeout }) {
  let locked = false
  let timer = null
  return {
    run(details, action, immediate = false) {
      if (locked) return false
      locked = true
      const finish = () => {
        timer = null
        try { action() } finally { locked = false; onChange(null) }
      }
      if (immediate) finish()
      else {
        onChange(details)
        timer = schedule(finish, FILL_TRANSITION_MS)
      }
      return true
    },
    dispose() {
      if (timer !== null) cancel(timer)
      timer = null
      locked = false
    },
  }
}
