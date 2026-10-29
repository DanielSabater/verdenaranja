// Cada paso tiene una posición estable para que deshacer invierta el giro.
export function arrivalControlDisplay({ mode, arrived, amount, countdown, active, showAmountAfterArrival }) {
  const stage = mode === 'paid' ? 4 : arrived ? 2 : 0
  const showAction = Boolean(active && !showAmountAfterArrival)
  return {
    step: stage + (showAction ? 1 : 0),
    text: showAction ? (mode === 'paid' ? 'Pago' : arrived ? 'Cobrar' : '¿Llegó?') : countdown?.label || amount,
    isAction: showAction,
  }
}
