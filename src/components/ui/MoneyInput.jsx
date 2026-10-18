import React, { useRef, useLayoutEffect, useState } from 'react'
import { moneyDraft, parseArgentineMoney, formatArgentineMoney, pastedArgentineMoney, moneyCaret } from '../../utils/argentineMoney.js'

export default function MoneyInput({ value, onChange, max, style }) {
  const input = useRef(null)
  const caret = useRef(null)
  const [pasteError, setPasteError] = useState('')
  const [editRevision, setEditRevision] = useState(0)
  useLayoutEffect(() => {
    if (caret.current !== null) { input.current?.setSelectionRange(caret.current, caret.current); caret.current = null }
    const amount = parseArgentineMoney(value)
    input.current?.setCustomValidity(pasteError || (!value ? '' : !Number.isFinite(amount) || amount <= 0 ? 'Ingresá un importe mayor a cero.' : amount > max ? 'El importe no puede superar el saldo pendiente.' : ''))
  }, [value, max, pasteError, editRevision])
  const update = (text, position) => {
    const formatted = moneyDraft(text)
    if (formatted === null) return
    const significant = (text.slice(0, position).match(/[\d,]/g) || []).length
    caret.current = moneyCaret(formatted, significant)
    setPasteError('')
    setEditRevision(revision => revision + 1)
    onChange(formatted)
  }
  return <span style={{ display: 'block', position: 'relative' }}>
    <span aria-hidden="true" style={{ position: 'absolute', left: 12, top: 12, color: 'inherit', pointerEvents: 'none' }}>$</span>
    <input ref={input} required type="text" inputMode="decimal" placeholder="0,00" value={value} style={{ ...style, paddingLeft: 30 }}
      aria-invalid={pasteError ? true : undefined}
      onChange={event => update(event.target.value, event.target.selectionStart ?? event.target.value.length)}
      onBlur={() => { const amount = parseArgentineMoney(value); if (Number.isFinite(amount)) onChange(formatArgentineMoney(amount)) }}
      onPaste={event => {
        event.preventDefault()
        const pasted = pastedArgentineMoney(event.clipboardData.getData('text'))
        if (pasted === null) { setPasteError('Usá formato argentino: 30.000,50 (coma para centavos).'); return }
        const element = event.currentTarget
        const start = element.selectionStart ?? 0, end = element.selectionEnd ?? start
        const inserted = pasted.replace(/\./g, '')
        update(value.slice(0, start) + inserted + value.slice(end), start + inserted.length)
      }}
      onKeyDown={event => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
        const element = event.currentTarget
        const start = element.selectionStart ?? 0, end = element.selectionEnd ?? start
        if (start !== end) return
        // Al borrar junto a un separador de miles también se borra el dígito vecino.
        if (event.key === 'Backspace' && value[start - 1] === '.') {
          event.preventDefault(); update(value.slice(0, Math.max(0, start - 2)) + value.slice(start), Math.max(0, start - 2))
        } else if (event.key === 'Delete' && value[start] === '.') {
          event.preventDefault(); update(value.slice(0, start) + value.slice(start + 2), start)
        }
      }} />
    {pasteError && <span role="alert" style={{ display: 'block', fontSize: 12, marginTop: 6, color: '#a83232' }}>{pasteError}</span>}
  </span>
}
