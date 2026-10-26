import { useEffect, useRef, useState } from 'react'
import { createFillTransition } from '../utils/fillTransition.js'

export function useFillTransition() {
  const [pending, setPending] = useState(null)
  const controller = useRef(null)
  if (!controller.current) controller.current = createFillTransition({ onChange: setPending })
  useEffect(() => () => controller.current.dispose(), [])
  return {
    pending,
    run: (details, action) => controller.current.run(details, action, window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  }
}
