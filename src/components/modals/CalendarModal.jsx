import { useEffect, useRef } from 'react'
import { Overlay } from '../ui/index.jsx'
import { hasRealAppointments } from '../../utils/appointments.js'
import { fmtDate, MESES_ES, nextWorkDay, todayKey } from '../../utils/dates.js'
import { calendarMonthDays, shiftCalendarMonth } from '../../utils/calendar.js'
import './CalendarModal.css'

function MonthCard({ monthKey, position, currentDate, today, allData, navigate, select }) {
  const [year, month] = monthKey.split('-').map(Number)
  const cells = calendarMonthDays(monthKey)
  const preview = position !== 'main'
  const title = `${MESES_ES[month - 1]} ${year}`
  const classes = `vn-calendar-month vn-calendar-month-${position}${cells.length > 35 ? ' vn-calendar-six-weeks' : ''}`
  const content = <>
    <div className="vn-calendar-brand">VERDE NARANJA · AGENDA</div>
    <div className="vn-calendar-monthhead">
      {preview ? <span className="vn-calendar-arrow">‹</span> :
        <button type="button" data-no-touch-target="true" className="vn-calendar-arrow" aria-label="Mes anterior" onClick={() => navigate(-1)}>‹</button>}
      <div className="vn-calendar-title">
        <h2>{MESES_ES[month - 1]}</h2>
        <span>{year}</span>
      </div>
      {preview ? <span className="vn-calendar-arrow">›</span> :
        <button type="button" data-no-touch-target="true" className="vn-calendar-arrow" aria-label="Mes siguiente" onClick={() => navigate(1)}>›</button>}
    </div>
    <div className="vn-calendar-grid" aria-label={preview ? undefined : `Días de ${title}`}>
      {['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].map(day => <span className="vn-calendar-weekday" key={day}>{day}</span>)}
      {cells.map((date, i) => {
        if (!date) return <span key={`empty-${i}`} className="vn-calendar-day vn-calendar-empty" />
        const selected = date.key === currentDate
        const marked = hasRealAppointments(allData?.[date.key])
        const className = `vn-calendar-day${date.sunday ? ' vn-calendar-sunday' : ''}${selected ? ' vn-calendar-chosen' : ''}${marked ? ' vn-calendar-mark' : ''}`
        return <button type="button" data-no-touch-target="true" key={date.key} className={className} tabIndex={preview ? -1 : 0}
          aria-label={`${fmtDate(date.key)} de ${year}`} aria-pressed={selected}
          aria-current={date.key === today ? 'date' : undefined} data-date={date.key}
          onClick={event => { event.stopPropagation(); select(date.key) }}>{date.day}</button>
      })}
    </div>
    <div className="vn-calendar-rule">
      <span>🌿 {preview || !currentDate.startsWith(monthKey) ? 'Calendario mensual' : fmtDate(currentDate)}</span>
      {preview ? <span className="vn-calendar-today">HOY</span> :
        <button type="button" data-no-touch-target="true" className="vn-calendar-today" onClick={() => {
          select(new Date(`${today}T12:00:00`).getDay() === 0 ? nextWorkDay(today, 1) : today)
        }}>HOY</button>}
    </div>
  </>
  return <section className={classes} aria-label={title}
    onClick={preview ? () => navigate(position === 'prev' ? -1 : 1) : undefined}>{content}</section>
}

export function CalendarModal({ monthKey, currentDate, allData, onMonthChange, onSelect, onClose }) {
  const dialog = useRef(null)
  const pointerStart = useRef(null)
  const suppressClickUntil = useRef(0)
  const centerTodayPending = useRef(null)
  const today = todayKey()
  const navigate = delta => onMonthChange(shiftCalendarMonth(monthKey, delta))

  useEffect(() => {
    const opener = document.activeElement
    const target = dialog.current?.querySelector('.vn-calendar-month-main button[aria-pressed="true"]:not(:disabled)')
      || dialog.current?.querySelector('.vn-calendar-month-main button')
    target?.focus({ preventScroll: true })
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])

  useEffect(() => {
    if (centerTodayPending.current) {
      dialog.current?.querySelector(`.vn-calendar-month-main button[data-date="${centerTodayPending.current}"]`)?.focus({ preventScroll: true })
      centerTodayPending.current = null
    } else if (dialog.current && !dialog.current.contains(document.activeElement)) {
      // El día enfocado puede desaparecer al cambiar de mes.
      dialog.current.querySelector('.vn-calendar-month-main button')?.focus({ preventScroll: true })
    }
  }, [monthKey])

  useEffect(() => {
    const handleCalendarKey = event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return
      const target = event.target
      if (target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return
      const modals = [...document.querySelectorAll('[aria-modal="true"]')]
      const overlays = [...document.querySelectorAll('.modal-overlay')]
      if (modals.at(-1) !== dialog.current || overlays.at(-1) !== dialog.current?.closest('.modal-overlay')) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); event.stopPropagation()
        onMonthChange(shiftCalendarMonth(monthKey, event.key === 'ArrowLeft' ? -1 : 1))
      } else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault(); event.stopPropagation()
        // Leer el reloj al pulsar, incluso si el modal quedó abierto al cambiar de día.
        const realToday = todayKey()
        const todayMonth = realToday.slice(0, 7)
        if (monthKey === todayMonth) {
          dialog.current?.querySelector(`.vn-calendar-month-main button[data-date="${realToday}"]`)?.focus({ preventScroll: true })
        } else {
          centerTodayPending.current = realToday
          onMonthChange(todayMonth)
        }
      }
    }
    // Captura solo mientras el calendario está abierto: no depende del control enfocado.
    window.addEventListener('keydown', handleCalendarKey, true)
    return () => window.removeEventListener('keydown', handleCalendarKey, true)
  }, [monthKey, onMonthChange])

  const onKeyDown = event => {
    if (event.key !== 'Tab') return
    const buttons = [...dialog.current.querySelectorAll('button:not(:disabled):not([tabindex="-1"])')]
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return <Overlay onClose={onClose} style={{ background: 'rgba(31,49,34,.25)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', padding: 12 }}>
    <div ref={dialog} className="vn-calendar-dialog" role="dialog" aria-modal="true" aria-label="Elegir fecha de la agenda" onKeyDown={onKeyDown}>
      <div className="vn-calendar-eyebrow">🌿 ELEGÍ UNA FECHA</div>
      <div className="vn-calendar-stage"
        onPointerDown={event => { if (event.isPrimary && event.button === 0) pointerStart.current = { x: event.clientX, y: event.clientY } }}
        onPointerCancel={() => { pointerStart.current = null }}
        onPointerUp={event => {
          const start = pointerStart.current; pointerStart.current = null
          if (!start) return
          const delta = event.clientX - start.x
          if (Math.abs(delta) > 50 && Math.abs(delta) > Math.abs(event.clientY - start.y)) {
            suppressClickUntil.current = Date.now() + 300
            navigate(delta < 0 ? 1 : -1)
          }
        }}
        onClickCapture={event => {
          if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation() }
        }}>
        <MonthCard monthKey={shiftCalendarMonth(monthKey, -1)} position="prev" {...{ currentDate, today, allData, navigate, select: onSelect }} />
        <MonthCard monthKey={monthKey} position="main" {...{ currentDate, today, allData, navigate, select: onSelect }} />
        <MonthCard monthKey={shiftCalendarMonth(monthKey, 1)} position="next" {...{ currentDate, today, allData, navigate, select: onSelect }} />
      </div>
      <div className="vn-calendar-hint">Tocá un día para ir a la agenda <span>· Deslizá para cambiar de mes</span></div>
    </div>
  </Overlay>
}
