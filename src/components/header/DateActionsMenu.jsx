import { useEffect, useRef, useState } from 'react'
import { C } from '../../constants/colors.js'
import './DateActionsMenu.css'

export function DateActionsMenu({ items, isLiquid, awayFromToday }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const skipFocusOpen = useRef(false)
  const today = items.find(item => item.id === 'hoy')
  const options = items.filter(item => item.id !== 'hoy')

  useEffect(() => {
    if (!open) return
    const closeOutside = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const closeEscape = event => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopPropagation()
      setOpen(false)
      skipFocusOpen.current = true
      trigger.current?.focus({ preventScroll: true })
      skipFocusOpen.current = false
    }
    document.addEventListener('pointerdown', closeOutside, true)
    window.addEventListener('keydown', closeEscape, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true)
      window.removeEventListener('keydown', closeEscape, true)
    }
  }, [open])

  return <div ref={root} className="date-actions-island date-more-actions" data-open={open}
    style={{ '--quick-menu-surface': isLiquid ? 'rgba(255,255,255,.75)' : C.white }}
    onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true) }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') setOpen(false) }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => {
      if (!open || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault(); event.stopPropagation()
      const options = [...root.current.querySelectorAll('[role="menuitem"]')]
      const index = options.indexOf(document.activeElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : (index + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) + options.length) % options.length
      options[next]?.focus()
    }}>
    <button ref={trigger} type="button" className={`date-more-trigger${awayFromToday ? ' date-more-trigger-away' : ''}`} aria-label={open ? 'Ir a hoy' : 'Abrir accesos rápidos'}
      aria-haspopup="menu" aria-expanded={open} aria-controls="date-more-menu"
      onClick={() => {
        if (!open) setOpen(true)
        else today?.action()
      }}
      onFocus={event => { if (!skipFocusOpen.current && event.currentTarget.matches(':focus-visible')) setOpen(true) }}
      onKeyDown={event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault(); event.stopPropagation(); setOpen(true)
          requestAnimationFrame(() => {
            const options = [...root.current.querySelectorAll('[role="menuitem"]')]
            ;(event.key === 'ArrowUp' ? options.at(-1) : options[0])?.focus()
          })
        }
      }}>
      <span aria-hidden="true">{open ? 'Hoy' : '+'}</span>
    </button>
    <div className="date-more-menu-bridge" inert={open ? undefined : ''} aria-hidden={!open}>
      <div id="date-more-menu" className="date-more-menu" role="menu" aria-label="Acciones de la agenda">
        {options.map(item => <div className="date-more-option-island" key={item.id}>
          <button type="button" role="menuitem" className="date-more-item" aria-label={item.label} title={item.label}
            onClick={() => { setOpen(false); item.action() }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {item.id === 'buscar' ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>
                : item.id === 'gasto' ? <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></>
                : <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01" /></>}
            </svg>
          </button>
        </div>)}
      </div>
    </div>
  </div>
}
