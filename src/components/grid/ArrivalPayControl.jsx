import { C } from '../../constants/colors.js'
import { useState, useRef, useLayoutEffect } from 'react'
import { arrivalControlDisplay } from '../../utils/arrivalControlDisplay.js'
import { useFillTransition } from '../../hooks/useFillTransition.js'

function RotatingLabel({ face }) {
  const previous = useRef(face)
  const sequence = useRef(0)
  const [change, setChange] = useState(null)
  useLayoutEffect(() => {
    if (previous.current.step !== face.step) {
      setChange({ previous: previous.current, reverse: face.step < previous.current.step, id: ++sequence.current })
    }
    previous.current = face
  }, [face.step, face.text, face.isAction])
  return <span className="arrival-control-rotation" aria-hidden="true" data-direction={change?.reverse ? 'backward' : 'forward'}>
    {change && <span key={`old-${change.id}`} className="arrival-control-face arrival-control-face-out">{change.previous.text}</span>}
    <span key={change?.id || 0} className={`arrival-control-face${change ? ' arrival-control-face-in' : ''}`}
      onAnimationEnd={() => setChange(null)}>{face.text}</span>
  </span>
}

// Reutiliza las acciones existentes: la cruz nunca elimina sin la confirmación de la app.
export function ArrivalPayControl({ arrived, isMobile, onArrive, onPay, onUndoPay, onDelete, mode = 'appointment', color, onEdit, amount, countdown, fillTransition, transitionLocked = false }) {
  const localFill = useFillTransition()
  const activeFill = localFill.pending || fillTransition
  const busy = Boolean(activeFill || transitionLocked)
  const [showAmountAfterArrival, setShowAmountAfterArrival] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const face = arrivalControlDisplay({ mode, arrived, amount, countdown, active: hovered || focused, showAmountAfterArrival })
  const canResetArrival = mode === 'appointment' && arrived
  const filled = mode !== 'appointment' || arrived
  const background = color || (mode === 'note' ? C.green : C.orange)
  const label = mode === 'paid' ? 'Pago' : mode === 'note' ? 'Editar' : arrived ? 'Abonar' : '¿Llegó?'
  const actionLabel = mode === 'paid' ? 'Revisar pago' : mode === 'note' ? 'Editar anotación' : arrived ? 'Abonar turno' : 'Marcar llegada'
  const mainAction = mode === 'note' ? onEdit : mode === 'paid' || arrived ? onPay : onArrive
  const crossLabel = mode === 'paid' ? 'Desmarcar pago' : canResetArrival ? 'Desmarcar llegada' : mode === 'note' ? 'Eliminar anotación' : 'Eliminar turno'
  const stop = event => event.stopPropagation()
  return <div className="arrival-pay-control" data-arrived={Boolean(arrived)} data-has-amount={Boolean(amount)} aria-busy={Boolean(activeFill)}
    aria-label={mode === 'paid' ? 'Turno pagado' : mode === 'note' ? 'Anotación' : arrived ? 'Clienta en el salón' : 'Llegada pendiente'}
    onMouseDown={stop} onDoubleClick={stop}
    style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch', height: isMobile ? 40 : 24,
      borderRadius: 8, overflow: 'hidden', boxSizing: 'border-box',
      background: filled ? background : 'rgba(232,121,58,.12)',
      border: `1px solid ${filled ? background : 'rgba(232,121,58,.4)'}`,
      borderTopColor: filled ? background : 'rgba(232,121,58,.4)' }}>
    {activeFill && <span className="arrival-control-fill" data-direction={activeFill.direction} aria-hidden="true" style={{ background: filled ? 'rgba(255,255,255,.24)' : 'rgba(232,121,58,.25)' }} />}
    <button type="button" aria-label={crossLabel} title={crossLabel} disabled={busy}
      onClick={event => {
        stop(event)
        if (canResetArrival) localFill.run({ direction: 'backward' }, () => onArrive?.())
        else (mode === 'paid' ? onUndoPay : onDelete)?.()
      }}
      style={{ position: 'relative', zIndex: 1, border: 'none', borderRight: `1px solid ${filled ? 'rgba(255,255,255,.3)' : 'rgba(232,121,58,.3)'}`,
        background: 'transparent', color: filled ? '#fff' : C.orange,
        padding: 0, width: isMobile ? 24 : 20, font: '10px Georgia,serif', cursor: 'pointer' }}>
      ✕
    </button>
    <button type="button" data-amount-action={Boolean(amount) && !showAmountAfterArrival} disabled={busy} aria-label={amount ? `${actionLabel}, ${amount}${countdown ? `. ${countdown.description}` : ''}` : actionLabel}
      title={countdown ? `${countdown.description}. ${amount}. ${actionLabel}` : canResetArrival ? 'Clienta en el salón. Abrir cobro' : actionLabel}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }}
      onPointerLeave={() => { setHovered(false); setShowAmountAfterArrival(false) }}
      onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => { setFocused(false); setShowAmountAfterArrival(false) }}
      onClick={event => {
        stop(event)
        if (mode === 'appointment' && !arrived) {
          localFill.run({ direction: 'forward' }, () => {
            setShowAmountAfterArrival(true)
            mainAction?.()
          })
        } else mainAction?.()
      }}
      style={{ position: 'relative', zIndex: 1, border: 'none', background: 'transparent', color: filled ? '#fff' : C.orange,
        padding: amount ? '0 5px' : isMobile ? '0 5px' : '0 7px', minWidth: amount ? (isMobile ? 60 : 76) : isMobile ? 26 : 60,
        display: 'grid', placeItems: 'center',
        font: `bold ${isMobile ? 12 : 10}px Georgia,serif`, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {amount ? <span style={{ display: 'grid', font: `bold ${face.isAction ? 10 : isMobile ? 11 : 12}px/13px Georgia,serif`, fontVariantNumeric: 'tabular-nums' }}><RotatingLabel face={face} /></span>
        : isMobile ? (mode === 'note' || mode === 'paid' ? '✏️' : arrived ? '💰' : '📍') : label}
    </button>
  </div>
}
