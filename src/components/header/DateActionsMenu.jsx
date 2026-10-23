import { useEffect, useRef, useState } from 'react'
import { C } from '../../constants/colors.js'
import './DateActionsMenu.css'

export function DateActionsMenu({ items, isLiquid, awayFromToday }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const skipFocusOpen = useRef(false)
  const pointerType = useRef('')

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

  return <div ref={root} className="date-actions-island date-more-actions"
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
    <button ref={trigger} type="button" className={`date-more-trigger${awayFromToday ? ' date-more-trigger-away' : ''}`} aria-label="Más acciones de la agenda"
      aria-haspopup="menu" aria-expanded={open} aria-controls="date-more-menu"
      onPointerDown={event => { pointerType.current = event.pointerType }}
      onClick={event => {
        if (event.detail === 0 || pointerType.current !== 'mouse') setOpen(value => !value)
        else setOpen(true)
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
      <span aria-hidden="true">+</span>
    </button>
    {open && <div className="date-more-menu-bridge">
      <div id="date-more-menu" className="date-more-menu" role="menu" aria-label="Acciones de la agenda">
        {items.map(item => <button key={item.id} type="button" role="menuitem"
          className={`date-more-item${item.highlighted ? ' date-more-item-highlighted' : ''}`}
          onClick={() => { setOpen(false); item.action() }}>
          <span className="date-more-item-icon" aria-hidden="true">{item.content}</span>
          <span>{item.label}</span>
        </button>)}
      </div>
    </div>}
  </div>
}
