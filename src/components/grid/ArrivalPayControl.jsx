import { C } from '../../constants/colors.js'

// Reutiliza las acciones existentes: la cruz nunca elimina sin la confirmación de la app.
export function ArrivalPayControl({ arrived, isMobile, onArrive, onPay, onUndoPay, onDelete, mode = 'appointment', color, onEdit, amount }) {
  const canResetArrival = mode === 'appointment' && arrived
  const filled = mode !== 'appointment' || arrived
  const background = color || (mode === 'note' ? C.green : C.orange)
  const label = mode === 'paid' ? 'Pago' : mode === 'note' ? 'Editar' : arrived ? 'Abonar' : 'Llegó'
  const actionLabel = mode === 'paid' ? 'Revisar pago' : mode === 'note' ? 'Editar anotación' : arrived ? 'Abonar turno' : 'Marcar llegada'
  const mainAction = mode === 'note' ? onEdit : mode === 'paid' || arrived ? onPay : onArrive
  const crossLabel = mode === 'paid' ? 'Desmarcar pago' : canResetArrival ? 'Desmarcar llegada' : mode === 'note' ? 'Eliminar anotación' : 'Eliminar turno'
  const stop = event => event.stopPropagation()
  return <div className="arrival-pay-control" data-arrived={Boolean(arrived)} data-has-amount={Boolean(amount)}
    aria-label={mode === 'paid' ? 'Turno pagado' : mode === 'note' ? 'Anotación' : arrived ? 'Clienta en el salón' : 'Llegada pendiente'}
    onMouseDown={stop} onDoubleClick={stop}
    style={{ display: 'inline-flex', alignItems: 'stretch', height: isMobile ? 40 : 24,
      borderRadius: 8, overflow: 'hidden', boxSizing: 'border-box',
      background: filled ? background : 'rgba(232,121,58,.12)',
      border: `1px solid ${filled ? background : 'rgba(232,121,58,.4)'}`,
      borderTopColor: filled ? background : 'rgba(232,121,58,.4)' }}>
    <button type="button" aria-label={crossLabel} title={crossLabel}
      onClick={event => { stop(event); (mode === 'paid' ? onUndoPay : canResetArrival ? onArrive : onDelete)?.() }}
      style={{ border: 'none', borderRight: `1px solid ${filled ? 'rgba(255,255,255,.3)' : 'rgba(232,121,58,.3)'}`,
        background: 'transparent', color: filled ? '#fff' : C.orange,
        padding: 0, width: isMobile ? 24 : 20, font: '10px Georgia,serif', cursor: 'pointer' }}>
      ✕
    </button>
    <button type="button" data-amount-action={Boolean(amount)} aria-label={amount ? `${actionLabel}, ${amount}` : actionLabel}
      title={canResetArrival ? 'Clienta en el salón. Abrir cobro' : actionLabel}
      onClick={event => { stop(event); mainAction?.() }}
      style={{ border: 'none', background: 'transparent', color: filled ? '#fff' : C.orange,
        padding: amount ? '0 5px' : isMobile ? '0 5px' : '0 7px', minWidth: amount ? (isMobile ? 60 : 76) : isMobile ? 26 : 60,
        display: 'grid', placeItems: 'center',
        font: `bold ${isMobile ? 12 : 10}px Georgia,serif`, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {amount ? <>
        <span className="arrival-control-amount" aria-hidden="true" style={{ gridArea: '1 / 1', font: `bold ${isMobile ? 11 : 12}px/13px Georgia,serif`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{amount}</span>
        <span className="arrival-control-hover-action" aria-hidden="true" style={{ gridArea: '1 / 1', font: 'bold 10px/13px Georgia,serif', whiteSpace: 'nowrap' }}>
          {mode === 'appointment' && arrived ? 'Cobrar' : label}
        </span>
      </> : isMobile ? (mode === 'note' || mode === 'paid' ? '✏️' : arrived ? '💰' : '📍') : label}
    </button>
  </div>
}
