// Cada paso tiene una posición estable para que deshacer invierta el giro.
export function arrivalControlDisplay({ mode, arrived, amount, countdown, active, showAmountAfterArrival }) {
  const stage = mode === 'paid' ? 4 : arrived ? 2 : 0
  const showAction = active && !showAmountAfterArrival
  return {
    step: stage + (showAction ? 1 : 0),
    text: mode === 'paid' ? (active ? amount : 'Pago') : showAction ? (arrived ? 'Cobrar' : '¿Llegó?') : countdown?.label || amount,
    isAction: mode === 'paid' ? !active : showAction,
  }
}
