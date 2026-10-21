import { formatWaNumber, openWhatsAppLink } from "../../utils/whatsapp.js"
import { salaryDayBalances } from "../../utils/salaryDayBalances.js"
import MoneyInput from "../ui/MoneyInput.jsx"
import { parseArgentineMoney, formatArgentineMoney } from "../../utils/argentineMoney.js"
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { C } from '../../constants/colors.js'
import { fmt } from '../../utils/appointments.js'
import { todayKey } from '../../utils/dates.js'
import { salaryPayments, paidSalary, appendSalaryPayment, cancelSalaryPayment } from '../../utils/salaryPayments.js'
import { useMobileBackLayer } from '../../hooks/useMobileBack.js'

const button = { border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 16px', background: C.white, color: C.green, cursor: 'pointer', fontFamily: 'Georgia,serif' }
const field = { width: '100%', boxSizing: 'border-box', padding: 12, border: `1px solid ${C.border}`, borderRadius: 10, font: 'inherit', background: C.white }
export default function SalaryPanel({ professionals, sueldos, setSueldos, period, statsFor, breakdownFor, onReceipt, receiptOpen = false, waOpenMode = "app" }) {
  const [selected, select] = useState(null)
  const [bannerBottom, setBannerBottom] = useState(56)
  const [navigationBottom, setNavigationBottom] = useState(0)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayKey())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cancelling, setCancelling] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const operation = useRef(null)
  const backButton = useRef(null)
  useMobileBackLayer(Boolean(selected) && !receiptOpen, () => select(null))
  useEffect(() => {
    if (!selected) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!receiptOpen) backButton.current?.focus()
    const escape = e => { if (e.key === 'Escape' && !receiptOpen) select(null) }
    window.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', escape); previous?.focus() }
  }, [selected, receiptOpen])
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
  const open = p => {
    const balances = salaryDayBalances(recordFor(p.id), p.id, period, breakdownFor(p.id, 'all'))
    if (Object.values(balances).some(day => day.status === 'paid')) {
      const pending = Object.keys(balances).filter(day => balances[day].status !== 'paid')
      setSueldos(previous => ({ ...previous, [`${p.id}||${period}`]: { ...previous[`${p.id}||${period}`], pagos: salaryPayments(previous[`${p.id}||${period}`], p.id, period), dias: pending } }))
    }
    select(p); setCancelling(null); setCancelReason(''); setAmount(''); setDate(todayKey()); setNote(''); setError(''); setNotice(''); operation.current = crypto.randomUUID() }
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
      const { record, stats, paid, dayBalances, balance } = summary(selected)
      const history = Object.entries(sueldos).filter(([key]) => key.startsWith(`${selected.id}||`)).flatMap(([key, value]) => salaryPayments(value, selected.id, key.split('||')[1]).map(payment => ({ ...payment, periodo: key.split('||')[1] }))).sort((a, b) => b.fecha.localeCompare(a.fecha))
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
          setAmount(''); setNote(''); setNotice('Pago registrado en la cuenta.'); setError('')
        } catch (err) { setError(err.message) }
      }
      return <div role="dialog" aria-modal="false" aria-label={`Cuenta de ${selected.name}`} style={{ position: 'fixed', top: bannerBottom, bottom: navigationBottom, left: 0, right: 0, zIndex: 2000, background: C.cream, '--salary-banner-bottom': `${bannerBottom}px`, '--salary-navigation-bottom': `${navigationBottom}px`, overflowY: 'auto', fontFamily: 'Georgia,serif', color: C.text }}><style>{`
        .salary-sheet-content { max-width: 1200px; margin: 0 auto; padding: 16px clamp(16px, 3vw, 40px) 32px; }
        .salary-first-screen { box-sizing: border-box; }
        .salary-sheet-actions { margin-bottom: 18px; }
        .salary-account-heading { margin-top: 0 !important; gap: 12px !important; }
        .salary-account-heading h1 { margin: 10px 0 0; font-size: clamp(26px, 2.5vw, 34px); overflow-wrap: anywhere; }
        .salary-first-screen .salary-metrics { margin: 18px 0 !important; gap: 10px !important; }
        .salary-first-screen .salary-metrics > div { padding: 14px !important; }
        .salary-first-screen .salary-metrics strong { font-size: 22px !important; }
        .salary-account-summary > p { line-height: 1.5; font-size: 14px; margin: 12px 0; }
        .salary-account-summary > details { margin-top: 14px !important; font-size: 14px; }
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
          .salary-sheet-actions { margin-bottom: 14px; }
          .salary-first-screen .salary-metrics { margin: 14px 0 !important; }
          .salary-payment-form { padding: 18px !important; }
        }
        @media (max-width: 600px) {
          .salary-first-screen { min-height: 0; }
          .salary-sheet-content { padding-top: 14px; }
          .salary-first-screen .salary-metrics { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)) !important; }
          .salary-payment-form { padding: 16px !important; }
          .salary-payment-fields { grid-template-columns: 1fr !important; }
        }
        `}</style><div className="salary-sheet-content"><div className="salary-first-screen">
        <div className="salary-sheet-actions"><button ref={backButton} style={button} onClick={() => select(null)}>← Volver a sueldos</button></div>
        <div className="salary-primary-columns"><div className="salary-account-summary">
        <div className="salary-account-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 28 }}><div><div style={{ color: C.orange }}>CUENTA DEL PROFESIONAL · {period}</div><h1>{selected.emoji} {selected.name}</h1></div><button style={button} onClick={() => onReceipt(selected)}>Ver comprobante</button></div>
        {metrics([['Comisión a liquidar', stats.comision], ['Pagos aplicados a estos días', paid], [balance < 0 ? 'Saldo a favor' : 'Saldo pendiente', Math.abs(balance)]])}
        <p style={{ color: C.textSoft }}>{stats.turnos} turnos · {stats.dias} días trabajados · Facturado: {fmt(stats.facturado)} · Propinas: {fmt(stats.propinas)} (por separado)</p>
        {record.dias && record.dias !== 'all' && <p>Liquidación de días seleccionados: {record.dias.map(d => d.slice(-2)).join(', ') || 'ninguno'}. Se conserva la selección anterior.</p>}
        <details style={{ marginTop: 20 }}><summary style={{ cursor: 'pointer', color: C.green, width: 'fit-content', maxWidth: '100%' }}>Días incluidos en la liquidación</summary><p>Los días pagados siguen visibles. Los pagos parciales se distribuyen entre los días incluidos según su comisión.</p><button style={button} onClick={() => setSueldos(previous => ({ ...previous, [`${selected.id}||${period}`]: { ...previous[`${selected.id}||${period}`], pagos: salaryPayments(previous[`${selected.id}||${period}`], selected.id, period), dias: 'all' } }))}>Todos los días con turnos</button><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>{Object.keys(dayBalances).sort().map(day => <label key={day} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 9px', borderRadius: 8, border: `1px solid ${dayBalances[day]?.status === 'paid' ? C.greenMint : C.border}`, background: dayBalances[day]?.status === 'paid' ? C.greenPale : C.white, color: dayBalances[day]?.status === 'partial' ? C.orange : C.green }}><input type="checkbox" checked={!record.dias || record.dias === 'all' || record.dias.includes(day)} onChange={() => setSueldos(previous => {
          const key = `${selected.id}||${period}`
          const current = previous[key] || {}
          const days = !current.dias || current.dias === 'all' ? Object.keys(dayBalances).sort() : current.dias
          return { ...previous, [key]: { ...current, pagos: salaryPayments(current, selected.id, period), dias: days.includes(day) ? days.filter(d => d !== day) : [...days, day] } }
        })}/><span style={{ textDecoration: dayBalances[day]?.status === 'paid' ? 'line-through' : 'none' }}>{`${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(`${day}T12:00:00`).getDay()]} ${day.slice(8, 10)}/${day.slice(5, 7)}`}</span>{dayBalances[day]?.status === 'paid' && <small>✓ Pagado</small>}{dayBalances[day]?.status === 'partial' && <small>Parcial</small>}</label>)}</div></details>
        </div><section className="salary-payment-form" style={{ background: C.white, padding: 24, borderRadius: 18, border: `1px dashed ${C.green}`, marginTop: 24 }}><h2>Registrar un pago</h2><p>Se imputa a {selected.name} · {period}. Podés abonar una parte o el saldo completo.</p>
          {balance > 0 ? <form onSubmit={register}><div className="salary-payment-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}><label>Importe ($)<MoneyInput value={amount} max={balance} onChange={value => { setAmount(value); operation.current = crypto.randomUUID(); setNotice('') }} style={field}/></label><label>Fecha<input required type="date" value={date} onChange={e => { setDate(e.target.value); operation.current = crypto.randomUUID() }} style={field}/></label><label>Nota (opcional)<input value={note} onChange={e => { setNote(e.target.value); operation.current = crypto.randomUUID() }} style={field}/></label></div><div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}><button type="button" style={button} onClick={() => { setAmount(formatArgentineMoney(balance)); operation.current = crypto.randomUUID() }}>Usar saldo completo</button><button type="submit" disabled={!amount} style={{ ...button, background: C.green, color: C.white }}>Registrar pago</button></div></form> : <p>Este período no tiene saldo pendiente.</p>}
          {error && <p role="alert" style={{ color: '#a83232' }}>{error}</p>}{notice && <p role="status" style={{ color: C.green }}>{notice}</p>}
        </section></div></div>
        <h2 style={{ marginTop: 32 }}>Historial de pagos · todos los períodos</h2>
        {!history.length && <p>Todavía no hay pagos registrados.</p>}
        {history.map(payment => <div key={`${payment.periodo}:${payment.id}`} style={{ padding: 18, background: C.white, borderRadius: 12, marginBottom: 10, border: `1px solid ${C.border}` }}>
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
        <h2 style={{ marginTop: 32 }}>Detalle del período</h2>{breakdownFor(selected.id, record.dias || 'all').map(day => <details key={day.dk} style={{ background: C.white, padding: 16, borderBottom: `1px dashed ${C.border}` }}><summary style={{ cursor: 'pointer' }}>{day.dateLabel} · {day.turnos} turnos · Comisión {fmt(day.comision)}</summary>{day.appts.map((a, i) => <p key={i}>{a.hour} · {a.clientName} · Comisión: {fmt(a.comision)}</p>)}</details>)}
      </div></div>
    })(), document.body)}
  </>
}
