import { formatWaNumber, openWhatsAppLink } from "../../utils/whatsapp.js"
import { salaryDayBalances } from "../../utils/salaryDayBalances.js"
import MoneyInput from "../ui/MoneyInput.jsx"
import { parseArgentineMoney, formatArgentineMoney } from "../../utils/argentineMoney.js"
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { C } from '../../constants/colors.js'
import { fmt } from '../../utils/appointments.js'
import { todayKey, MESES_ES } from '../../utils/dates.js'
import { calendarMonthDays } from '../../utils/calendar.js'
import './SalaryPanel.css'
import { salaryPayments, paidSalary, appendSalaryPayment, cancelSalaryPayment, salaryPaymentHistory } from '../../utils/salaryPayments.js'
import { useMobileBackLayer } from '../../hooks/useMobileBack.js'
import { salaryReceiptMessage } from '../../utils/salaryReceiptMessage.js'

const button = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 16px', background: C.white, color: C.green, cursor: 'pointer', fontFamily: 'Georgia,serif' }
const field = { width: '100%', boxSizing: 'border-box', padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, font: 'inherit', background: C.white }
function ReceiptPreview({ message, onClose, onOpen }) {
  const dialog = useRef(null)
  const copyTimer = useRef(null)
  const [copyStatus, setCopyStatus] = useState(null)
  const copyReceipt = async () => {
    clearTimeout(copyTimer.current)
    setCopyStatus(null)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(message)
      setCopyStatus('success')
      copyTimer.current = setTimeout(() => setCopyStatus(null), 3000)
    } catch {
      setCopyStatus('error')
    }
  }
  useEffect(() => () => clearTimeout(copyTimer.current), [])
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => { if (element.open) element.close() }
  }, [])
  useMobileBackLayer(true, onClose)
  return <dialog ref={dialog} className="salary-receipt-dialog" aria-labelledby="salary-receipt-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="salary-receipt-brand">VERDE NARANJA · SUELDOS</div>
    <h2 id="salary-receipt-title">Enviar comprobante</h2>
    <p>Revisá el resumen antes de abrirlo en WhatsApp.</p>
    <div className="salary-receipt-preview" aria-label="Resumen de liquidación">{message}</div>
    <div className="salary-receipt-actions">
      <button type="button" onClick={onClose}>Cancelar</button>
      <button type="button" className="salary-receipt-copy" onClick={copyReceipt} aria-label="Copiar comprobante" title="Copiar comprobante">
        {copyStatus === 'success'
          ? <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
          : <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>}
      </button>
      <button type="button" className="salary-receipt-open" onClick={onOpen}>Abrir WhatsApp</button>
    </div>
    <span className="salary-receipt-sr-only" role="status">{copyStatus === 'success' ? 'Comprobante copiado.' : ''}</span>
    {copyStatus === 'error' && <div className="salary-receipt-copy-error" role="alert">No se pudo copiar. Seleccioná el texto del comprobante y copialo manualmente.<button type="button" onClick={() => setCopyStatus(null)} aria-label="Cerrar aviso">×</button></div>}
  </dialog>
}
export default function SalaryPanel({ professionals, sueldos, setSueldos, period, statsFor, breakdownFor, waOpenMode = "app" }) {
  const [selected, select] = useState(null)
  const [bannerBottom, setBannerBottom] = useState(56)
  const [navigationBottom, setNavigationBottom] = useState(0)
  const [amount, setAmount] = useState('')
  const [fullBalanceContext, setFullBalanceContext] = useState(null)
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [receiptNotice, setReceiptNotice] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const previewOpen = useRef(false)
  previewOpen.current = Boolean(receiptPreview)
  const [cancelling, setCancelling] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const operation = useRef(null)
  const backButton = useRef(null)
  useMobileBackLayer(Boolean(selected) && !receiptPreview, () => select(null))
  useEffect(() => {
    if (!selected) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    backButton.current?.focus()
    const escape = e => { if (e.key === 'Escape' && !previewOpen.current) select(null) }
    window.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', escape); previous?.focus() }
  }, [selected])
  useEffect(() => {
    if (!selected) return
    const banner = document.querySelector('.app-header-main')
    if (!banner) return
    const navigation = document.querySelector('.bottom-nav')
    const measure = () => {
      setBannerBottom(banner.getBoundingClientRect().bottom)
      setNavigationBottom(navigation?.getClientRects().length ? window.innerHeight - navigation.getBoundingClientRect().top : 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(banner)
    if (navigation) observer.observe(navigation)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [selected])
  const recordFor = id => sueldos[`${id}||${period}`] || {}
  const summary = (p, fullMonth = false) => {
    const record = recordFor(p.id)
    const stats = statsFor(p.id, fullMonth ? 'all' : record.dias || 'all')
    const dayBalances = salaryDayBalances(record, p.id, period, breakdownFor(p.id, 'all'))
    const paid = fullMonth || !record.dias || record.dias === 'all' ? paidSalary(record, p.id, period) : record.dias.reduce((sum, day) => sum + (dayBalances[day]?.paid || 0), 0)
    return { record, stats, paid, dayBalances, balance: Math.round((stats.comision - paid) * 100) / 100 }
  }
  const selectedSummary = selected ? summary(selected) : null
  const paymentContext = selectedSummary && JSON.stringify([selected.id, period, selectedSummary.record.dias === 'all' || !selectedSummary.record.dias ? 'all' : [...selectedSummary.record.dias].sort(), selectedSummary.balance])
  const fullBalanceSelected = fullBalanceContext !== null && fullBalanceContext === paymentContext
  useEffect(() => {
    if (fullBalanceContext !== null && fullBalanceContext !== paymentContext) {
      setAmount('')
      setFullBalanceContext(null)
    }
  }, [fullBalanceContext, paymentContext])
  const open = p => {
    const balances = salaryDayBalances(recordFor(p.id), p.id, period, breakdownFor(p.id, 'all'))
    if (Object.values(balances).some(day => day.status === 'paid')) {
      const pending = Object.keys(balances).filter(day => balances[day].status !== 'paid')
      setSueldos(previous => ({ ...previous, [`${p.id}||${period}`]: { ...previous[`${p.id}||${period}`], pagos: salaryPayments(previous[`${p.id}||${period}`], p.id, period), dias: pending } }))
    }
    select(p); setCancelling(null); setCancelReason(''); setAmount(''); setFullBalanceContext(null); setDate(todayKey()); setNote(''); setError(''); setNotice(''); setReceiptNotice(null); operation.current = crypto.randomUUID() }
  const sharePayment = (professional, payment) => {
    const phone = formatWaNumber(professional.phone || '')
    if (!phone) {
      setError('Cargá el teléfono de la profesional en Configuración para abrir su chat de WhatsApp.')
      return
    }
    const dateLabel = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : 'No registrada'
    const [year, month] = payment.periodo.split('-').map(Number)
    const periodLabel = new Date(year, month - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    const days = !payment.dias || payment.dias === 'all' ? 'Mes completo' : [...payment.dias].sort().map(day => `${day.slice(8, 10)}/${day.slice(5, 7)}`).join(', ')
    const lines = [
      '🌿 *VERDE NARANJA*',
      '🧾 *RESUMEN DE PAGO*',
      `👤 *${professional.name}*`,
      `📅 Período: ${periodLabel}`,
      '─────────────────────────',
      `Fecha de pago: ${dateLabel(payment.fecha)}`,
      `Días incluidos: ${days || 'Sin días especificados'}`,
      '',
      `💰 *Importe abonado: ${fmt(payment.monto)}*`,
      ...(payment.nota ? ['', `Nota: ${payment.nota}`] : []),
      '',
      'Este resumen corresponde al pago indicado.'
    ]
    setError('')
    const opened = openWhatsAppLink(phone, lines.join('\n'), waOpenMode)
    setNotice(opened ? 'Resumen preparado en WhatsApp. Revisalo antes de enviarlo.' : 'No se pudo abrir WhatsApp. Revisá el teléfono y la configuración.')
  }
  const rows = professionals.map(p => ({ p, ...summary(p, true) }))
  const totals = rows.reduce((a, r) => [a[0] + r.stats.comision, a[1] + r.paid, a[2] + Math.max(0, r.balance)], [0, 0, 0])
  const metrics = values => <div className="salary-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, margin: '20px 0' }}>{values.map(([label, value]) => <div key={label} style={{ background: C.cream, borderRadius: 14, padding: 18, border: `1px dashed ${C.border}` }}><div style={{ color: C.textSoft, fontSize: 12 }}>{label}</div><strong style={{ display: 'block', marginTop: 8, color: label.includes('pendiente') ? C.orange : C.green, fontSize: 24 }}>{fmt(value)}</strong></div>)}</div>
  return <>
    {metrics([['Comisiones del período', totals[0]], ['Pagos registrados', totals[1]], ['Saldo pendiente', totals[2]]])}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))', gap: 16 }}>{rows.map(({ p, stats, paid, balance }) => <button key={p.id} onClick={() => open(p)} style={{ ...button, padding: 22, textAlign: 'left', border: `1.5px solid ${C.border}` }}><div style={{ fontSize: 22 }}>{p.emoji} {p.name}</div><p style={{ color: C.textSoft }}>{stats.turnos} turnos · {stats.dias} días trabajados</p><div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 16, display: 'flex', justifyContent: 'space-between' }}><span>{balance > 0 ? 'Pendiente' : balance < 0 ? 'Saldo a favor' : paid > 0 ? 'Saldado' : 'Sin saldo'}</span><strong style={{ color: balance > 0 ? C.orange : C.green }}>{fmt(Math.abs(balance))}</strong></div><div style={{ marginTop: 18, fontSize: 12 }}>Ver cuenta y registrar pagos →</div></button>)}</div>
    {!rows.length && <p>No hay profesionales para este período.</p>}
    {selected && createPortal((() => {
      const { record, stats, paid, dayBalances, balance } = selectedSummary
      const shareReceipt = () => {
        const phone = formatWaNumber(selected.phone || '')
        if (!phone) {
          setReceiptNotice({ error: true, text: 'Cargá el teléfono de la profesional en Configuración para abrir su chat de WhatsApp.' })
          return
        }
        const message = salaryReceiptMessage({ professional: selected, period, days: breakdownFor(selected.id, record.dias || 'all'), stats, paid, balance })
        setReceiptNotice(null)
        setReceiptPreview({ phone, message })
      }
      const history = salaryPaymentHistory(sueldos, selected.id)
      const register = e => {
        e.preventDefault()
        const payment = { id: operation.current, monto: parseArgentineMoney(amount), fecha: date, nota: note.trim(), profesionalId: selected.id, periodo: period, dias: record.dias || 'all', creadoEn: new Date().toISOString() }
        try {
          appendSalaryPayment(record, payment, paidSalary(record, selected.id, period) + balance)
          setSueldos(previous => {
            const key = `${selected.id}||${period}`
            try {
              const current = previous[key] || {}
              const allocated = salaryDayBalances(current, selected.id, period, breakdownFor(selected.id, 'all'))
              const applied = payment.dias === 'all' ? paidSalary(current, selected.id, period) : payment.dias.reduce((sum, day) => sum + (allocated[day]?.paid || 0), 0)
              const remaining = statsFor(selected.id, payment.dias).comision - applied
              return { ...previous, [key]: appendSalaryPayment(current, payment, paidSalary(current, selected.id, period) + remaining) }
            } catch { return previous }
          })
          setAmount(''); setFullBalanceContext(null); setNote(''); setNotice('Pago registrado en la cuenta.'); setError('')
        } catch (err) { setError(err.message) }
      }
      return <div role="dialog" aria-modal="false" aria-label={`Cuenta de ${selected.name}`} style={{ position: 'fixed', top: bannerBottom, bottom: navigationBottom, left: 0, right: 0, zIndex: 2000, background: C.cream, '--salary-banner-bottom': `${bannerBottom}px`, '--salary-navigation-bottom': `${navigationBottom}px`, overflowY: 'auto', fontFamily: 'Georgia,serif', color: C.text }}><style>{`
        .salary-sheet-content { max-width: 1200px; margin: 0 auto; padding: 10px clamp(16px, 3vw, 40px) 32px; }
        .salary-first-screen { box-sizing: border-box; }
        .salary-sheet-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin-bottom: clamp(16px, 2vw, 24px); }
        .salary-sheet-context { color: ${C.orange}; font-size: 13px; }
        .salary-account-heading { margin-top: 0 !important; gap: 12px !important; }
        .salary-account-heading h1 { margin: 0; font-size: clamp(26px, 2.5vw, 34px); overflow-wrap: anywhere; }
        .salary-first-screen .salary-metrics { margin: 10px 0 !important; gap: 8px !important; }
        .salary-first-screen .salary-metrics > div { padding: 14px !important; }
        .salary-first-screen .salary-metrics strong { font-size: 22px !important; }
        .salary-account-intro > p { line-height: 1.35; font-size: 13px; margin: 7px 0; }
        .salary-payment-form { margin-top: 20px !important; padding: 20px !important; }
        .salary-payment-form h2 { margin: 0 0 10px; font-size: 24px; }
        .salary-payment-form > p { font-size: 14px; line-height: 1.45; margin: 0 0 18px; }
        .salary-payment-form label { font-size: 14px; line-height: 1.5; }
        .salary-payment-fields { gap: 14px !important; }
        @media (min-width: 960px) {
          .salary-primary-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: clamp(20px, 3vw, 40px); }
          .salary-account-heading { align-items: flex-start !important; }
          .salary-account-heading > button { margin-top: 0; }
          .salary-first-screen .salary-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .salary-first-screen .salary-metrics > div { padding: 12px !important; }
          .salary-first-screen .salary-metrics strong { font-size: clamp(18px, 1.6vw, 22px) !important; }
          .salary-payment-form { margin-top: 0 !important; }
          .salary-payment-fields { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .salary-payment-fields > label:last-child { grid-column: 1 / -1; }
        }
        @media (max-height: 720px) and (min-width: 960px) {
          .salary-first-screen .salary-metrics { margin: 8px 0 !important; }
          .salary-payment-form { padding: 18px !important; }
        }
        @media (min-width: 1100px) {
          .salary-sheet-content { max-width: 1500px; }
          .salary-primary-columns { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: clamp(16px, 2vw, 30px); }
          .salary-account-summary { display: contents; }
          .salary-account-intro, .salary-calendar, .salary-payment-form { box-sizing: border-box; min-width: 0; height: 100%; }
          .salary-calendar { margin-top: 0; }
          .salary-first-screen .salary-metrics { grid-template-columns: 1fr !important; }
          .salary-first-screen .salary-metrics > div { padding: 10px 12px !important; }
          .salary-first-screen .salary-metrics strong { margin-top: 4px !important; }
          .salary-payment-fields { grid-template-columns: 1fr !important; }
          .salary-payment-fields > label:last-child { grid-column: auto; }
        }
        @media (max-width: 600px) {
          .salary-first-screen { min-height: 0; }
          .salary-sheet-content { padding-top: 14px; }
          .salary-first-screen .salary-metrics { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) !important; }
          .salary-payment-form { padding: 16px !important; }
          .salary-payment-fields { grid-template-columns: 1fr !important; }
        }
        `}</style><div className="salary-sheet-content"><div className="salary-first-screen">
        <div className="salary-sheet-actions"><button ref={backButton} style={button} onClick={() => select(null)}>← Volver a sueldos</button><div className="salary-sheet-context">CUENTA DEL PROFESIONAL · {period}</div></div>
        <div className="salary-primary-columns"><div className="salary-account-summary"><div className="salary-account-intro">
        <div className="salary-account-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 28 }}><h1>{selected.emoji} {selected.name}</h1><button style={button} onClick={shareReceipt}>Enviar comprobante</button></div>
        {receiptNotice && <p role={receiptNotice.error ? 'alert' : 'status'} style={{ color: receiptNotice.error ? '#a83232' : C.green }}>{receiptNotice.text}</p>}
        {metrics([['Comisión a liquidar', stats.comision], ['Pagos aplicados a estos días', paid], [balance < 0 ? 'Saldo a favor' : 'Saldo pendiente', Math.abs(balance)]])}
        <p style={{ color: C.textSoft }}>{stats.turnos} turnos · {stats.dias} días trabajados · Facturado: {fmt(stats.facturado)} · Propinas: {fmt(stats.propinas)} (por separado)</p>
        {record.dias && record.dias !== 'all' && <p>Liquidación de días seleccionados: {record.dias.map(d => d.slice(-2)).join(', ') || 'ninguno'}. Se conserva la selección anterior.</p>}
        </div><div className="salary-calendar" role="group" aria-label={`Días de ${MESES_ES[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`}>
            <div className="salary-calendar-brand">VERDE NARANJA · SUELDOS</div>
            <div className="salary-calendar-title">{MESES_ES[Number(period.slice(5, 7)) - 1]} <span>{period.slice(0, 4)}</span></div>
            <div className="salary-calendar-grid">
              {['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].map(label => <span className="salary-calendar-weekday" key={label}>{label}</span>)}
              {calendarMonthDays(period).map((date, index) => {
                if (!date) return <span key={`empty-${index}`} />
                const day = date.key
                const dayBalance = dayBalances[day]
                const isSelected = Boolean(dayBalance) && (!record.dias || record.dias === 'all' || record.dias.includes(day))
                if (!dayBalance) return <span key={day} className="salary-calendar-day salary-calendar-inactive">{date.day}</span>
                const status = dayBalance.status === 'paid' ? 'pagado' : dayBalance.status === 'partial' ? 'pago parcial' : 'pendiente'
                return <button type="button" key={day} className={`salary-calendar-day salary-calendar-worked salary-calendar-${dayBalance.status}${isSelected ? ' salary-calendar-selected' : ''}`}
                  aria-label={`${date.day} de ${MESES_ES[Number(period.slice(5, 7)) - 1]}, ${status}`} aria-pressed={isSelected}
                  onClick={() => setSueldos(previous => {
                    const key = `${selected.id}||${period}`
                    const current = previous[key] || {}
                    const days = !current.dias || current.dias === 'all' ? Object.keys(dayBalances).sort() : current.dias
                    return { ...previous, [key]: { ...current, pagos: salaryPayments(current, selected.id, period), dias: days.includes(day) ? days.filter(d => d !== day) : [...days, day] } }
                  })}>{date.day}{isSelected && <span className="salary-calendar-check" aria-hidden="true">✓</span>}</button>
              })}
            </div>
            <div className="salary-calendar-legend"><span><i className="salary-calendar-legend-paid" /> Pagado</span><span><i className="salary-calendar-legend-partial" /> Parcial</span><span><i className="salary-calendar-legend-selected">✓</i> Seleccionado</span></div>
          </div>
        </div><section className="salary-payment-form" style={{ background: C.white, padding: 24, borderRadius: 18, border: `1px dashed ${C.green}`, marginTop: 24 }}><h2>Registrar un pago</h2><p>Se imputa a {selected.name} · {period}. Podés abonar una parte o el saldo completo.</p>
          {balance > 0 ? <form onSubmit={register}><div className="salary-payment-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}><label>Importe ($)<MoneyInput value={amount} max={balance} onChange={value => { if (value !== amount) setFullBalanceContext(null); setAmount(value); operation.current = crypto.randomUUID(); setNotice('') }} style={field}/></label><label>Fecha<input required type="date" value={date} onChange={e => { setDate(e.target.value); operation.current = crypto.randomUUID() }} style={field}/></label><label>Nota (opcional)<input value={note} onChange={e => { setNote(e.target.value); operation.current = crypto.randomUUID() }} style={field}/></label></div><div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}><button type="button" style={button} aria-pressed={fullBalanceSelected} onClick={() => { setAmount(fullBalanceSelected ? '' : formatArgentineMoney(balance)); setFullBalanceContext(fullBalanceSelected ? null : paymentContext); operation.current = crypto.randomUUID(); setNotice('') }}>{fullBalanceSelected ? 'Quitar saldo completo' : 'Usar saldo completo'}</button><button type="submit" disabled={!amount} style={{ ...button, background: C.green, color: C.white }}>Registrar pago</button></div></form> : <p>Este período no tiene saldo pendiente.</p>}
          {error && <p role="alert" style={{ color: '#a83232' }}>{error}</p>}{notice && <p role="status" style={{ color: C.green }}>{notice}</p>}
        </section></div></div>
        <h2 style={{ marginTop: 32 }}>Historial de pagos · todos los períodos</h2>
        {!history.length && <p>Todavía no hay pagos registrados.</p>}
        {history.map(group => <section key={group.periodo} aria-label={`Pagos de ${new Date(`${group.periodo}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`}>
          <h3 style={{ color: C.green, textTransform: 'capitalize', margin: '24px 0 12px' }}>{new Date(`${group.periodo}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</h3>
          {group.payments.map(payment => <div key={`${payment.periodo}:${payment.id}`} style={{ padding: 18, background: C.white, borderRadius: 12, marginBottom: 10, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><div><strong>{payment.fecha ? `Pago del ${payment.fecha.slice(8, 10)}/${payment.fecha.slice(5, 7)}/${payment.fecha.slice(0, 4)}` : 'Fecha no registrada'}</strong><div style={{ color: C.textSoft, fontSize: 12, marginTop: 6 }}>Período: {new Date(`${payment.periodo}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</div><div style={{ color: C.textSoft, fontSize: 12, marginTop: 6 }}>{payment.anterior ? 'Pago anterior conservado' : 'Pago registrado'}{payment.nota ? ` · ${payment.nota}` : ''}</div></div><strong style={{ color: payment.anulado ? C.textSoft : C.green, textDecoration: payment.anulado ? 'line-through' : 'none' }}>{fmt(payment.monto)}</strong></div>
          {!payment.anulado && <button type="button" onClick={() => sharePayment(selected, payment)} style={{ ...button, marginTop: 12, marginRight: 8, fontSize: 12, padding: '8px 12px' }} title="Abrir WhatsApp con el resumen de este pago">WhatsApp ↗</button>}
          {payment.anulado ? <p style={{ color: C.textSoft, fontSize: 12 }}>Anulado · {payment.motivoAnulacion} · {payment.anuladoEn ? new Date(payment.anuladoEn).toLocaleString('es-AR') : 'Fecha no registrada'}</p> : cancelling?.id === payment.id && cancelling?.periodo === payment.periodo ?
            <form onSubmit={event => {
              event.preventDefault()
              if (!cancelReason.trim()) return
              const reason = cancelReason.trim()
              const cancelledAt = new Date().toISOString()
              setSueldos(previous => {
                const key = `${selected.id}||${payment.periodo}`
                const current = previous[key] || {}
                const commission = statsFor(selected.id, current.dias || 'all', payment.periodo).comision
                const updated = cancelSalaryPayment(current, selected.id, payment.periodo, payment.id, reason, commission, cancelledAt)
                return updated === current ? previous : { ...previous, [key]: updated }
              })
              setCancelling(null); setCancelReason(''); setNotice(`Anulación registrada para ${payment.periodo}.`)
            }} style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${C.border}` }}>
              <p>¿Anular el pago de {fmt(payment.monto)} del {payment.fecha || 'día sin registrar'}, imputado a {payment.periodo}? El importe volverá al saldo pendiente de ese período. El registro se conservará.</p>
              <label>Motivo de la anulación<input required autoFocus value={cancelReason} onChange={event => setCancelReason(event.target.value)} style={field} /></label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}><button type="button" style={button} onClick={() => { setCancelling(null); setCancelReason('') }}>Conservar pago</button><button type="submit" disabled={!cancelReason.trim()} style={{ ...button, color: C.orange }}>Confirmar anulación</button></div>
            </form> : <button type="button" style={{ ...button, marginTop: 12, fontSize: 12, color: C.orange }} onClick={() => { setCancelling({ id: payment.id, periodo: payment.periodo }); setCancelReason('') }}>Anular pago</button>}
        </div>)}
        </section>)}
        <h2 style={{ marginTop: 32 }}>Detalle del período</h2>{breakdownFor(selected.id, record.dias || 'all').map(day => <details key={day.dk} style={{ background: C.white, padding: 16, borderBottom: `1px dashed ${C.border}` }}><summary style={{ cursor: 'pointer' }}>{day.dateLabel} · {day.turnos} turnos · Comisión {fmt(day.comision)}</summary>{day.appts.map((a, i) => <p key={i}>{a.hour} · {a.clientName} · Comisión: {fmt(a.comision)}</p>)}</details>)}
      </div></div>
    })(), document.body)}
    {receiptPreview && <ReceiptPreview message={receiptPreview.message} onClose={() => setReceiptPreview(null)} onOpen={() => {
      const opened = openWhatsAppLink(receiptPreview.phone, receiptPreview.message, waOpenMode)
      setReceiptPreview(null)
      setReceiptNotice(opened
        ? { error: false, text: 'Se intentó abrir WhatsApp con el resumen. Revisalo antes de enviarlo.' }
        : { error: true, text: 'No se pudo abrir WhatsApp. Revisá el teléfono y la configuración.' })
    }} />}
  </>
}
