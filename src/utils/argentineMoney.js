// La coma es el único separador decimal; el punto separa miles.
export function moneyDraft(value) {
  const plain = value.replace(/\./g, '')
  if (!/^\d*(,\d{0,2})?$/.test(plain)) return null
  if (!plain) return ''
  const [integer, decimals] = plain.split(',')
  return (integer || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decimals === undefined ? '' : `,${decimals}`)
}
export function parseArgentineMoney(value) {
  if (!value || !/^\d{1,3}(?:\.\d{3})*(?:,\d{0,2})?$/.test(value) && !/^\d+(?:,\d{0,2})?$/.test(value)) return NaN
  return Number(value.replace(/\./g, '').replace(',', '.'))
}
export function formatArgentineMoney(value) {
  if (!Number.isFinite(value)) return ''
  return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true })
}
export function pastedArgentineMoney(value) {
  const text = value.trim().replace(/^\$\s*/, '')
  return Number.isFinite(parseArgentineMoney(text)) ? moneyDraft(text) : null
}
export function moneyCaret(value, significantCharacters) {
  if (significantCharacters === 0) return 0
  let count = 0
  for (let index = 0; index < value.length; index++) if (/[\d,]/.test(value[index]) && ++count === significantCharacters) return index + 1
  return value.length
}
