import React, { useState, useMemo, useEffect } from "react"
import { createPortal } from "react-dom"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS, GASTO_CATS } from "../../constants/data.js"
import { fmt, apptTotal, apptPaidTotal } from "../../utils/appointments.js"
import { fmtDate, todayKey, toDateKey, MESES_ES, fmtShort } from "../../utils/dates.js"
import { Overlay, ModalHeader, Field, GhostBtn, SolidBtn, inputStyle, modalBox } from "../ui/index.jsx"

export default function ContabilidadView({
  allData, professionals, comisionPct, gastos, setGastos,
  gastoModal, setGastoModal, gastoForm, setGastoForm, editGastoId, setEditGastoId,
  sueldos, setSueldos, sueldoPeriod, setSueldoPeriod,
  contPeriod, setContPeriod, contFrom, setContFrom, contTo, setContTo,
}) {
  const [seccion, setSeccion] = useState("resumen")
  const [expandedDates, setExpandedDates] = useState({})
  const [receiptProf, setReceiptProf] = useState(null)
  const [activeZoomedChart, setActiveZoomedChart] = useState(null)
  const [hoveredProfId, setHoveredProfId] = useState(null)
  const [dollarRate, setDollarRate] = useState(940)

  useEffect(() => {
    fetch("https://dolarapi.com/v1/dolares/oficial")
      .then(res => res.json())
      .then(data => {
        if (data && data.venta) {
          setDollarRate(data.venta)
        }
      })
      .catch(err => console.warn("Error fetching official dollar rate:", err))
  }, [])

  const safeAllData       = allData && typeof allData === "object" && !Array.isArray(allData) ? allData : {}
  const safeGastos        = Array.isArray(gastos) ? gastos : []
  const safeSueldos       = sueldos && typeof sueldos === "object" && !Array.isArray(sueldos) ? sueldos : {}
  const safeProfessionals = Array.isArray(professionals) ? professionals : []

  // ── period filter ──────────────────────────────────────────────────────────
  const { rangeFrom, rangeTo } = useMemo(() => {
    const today = new Date()
    if (contPeriod === "dia") {
      const k = toDateKey(today)
      return { rangeFrom: k, rangeTo: k }
    }
    if (contPeriod === "semana") {
      const day = today.getDay()
      const mon = new Date(today); mon.setDate(today.getDate() + (day===0?-6:1-day))
      const sat = new Date(mon);   sat.setDate(mon.getDate() + 5)
      return { rangeFrom: toDateKey(mon), rangeTo: toDateKey(sat) }
    }
    if (contPeriod === "mes") {
      const y = today.getFullYear(), m = today.getMonth()
      return { rangeFrom: `${y}-${String(m+1).padStart(2,"0")}-01`, rangeTo: `${y}-${String(m+1).padStart(2,"0")}-${new Date(y,m+1,0).getDate()}` }
    }
    if (contPeriod === "custom") return { rangeFrom: contFrom, rangeTo: contTo }
    return { rangeFrom: "2000-01-01", rangeTo: "2099-12-31" }
  }, [contPeriod, contFrom, contTo])

  const inRange = (k) => k >= rangeFrom && k <= rangeTo

  // ── calculations ───────────────────────────────────────────────────────────
  const { totalIncome, incomeByProf, incomeByMethod, totalTurns, turnsByProf, incomeByService, countByService, incomeByDOW } = useMemo(() => {
    const byProf = {}, byMethod = {}, turnsByProf = {}, byService = {}, countService = {}, byDOW = {}
    safeProfessionals.forEach(p => { byProf[p.id] = 0; turnsByProf[p.id] = 0 })
    // Initialize DOW (0-6)
    for (let i=0; i<7; i++) byDOW[i] = 0

    let total = 0
    let turns = 0
    Object.entries(safeAllData).forEach(([dk, dayData]) => {
      if (!inRange(dk)) return
      const safeDayData = dayData || {}
      
      // DOW calculation
      const dateObj = new Date(dk + "T12:00:00")
      const dow = dateObj.getDay()

      Object.values(safeDayData).forEach(appt => {
        if (!appt?.paid) return
        const t = apptPaidTotal(appt)
        total += t
        turns += 1
        byProf[appt.profId] = (byProf[appt.profId] || 0) + t
        turnsByProf[appt.profId] = (turnsByProf[appt.profId] || 0) + 1
        byDOW[dow] = (byDOW[dow] || 0) + t

        // Service stats
        if (appt.services?.length) {
          appt.services.forEach(s => {
            const price = parseFloat(s.price) || 0
            byService[s.name] = (byService[s.name] || 0) + price
            countService[s.name] = (countService[s.name] || 0) + 1
          })
        }

        if (appt.paymentSplits?.length) {
          appt.paymentSplits.forEach(s => { byMethod[s.methodId] = (byMethod[s.methodId]||0) + (parseFloat(s.amount)||0) })
        } else if (appt.payMethod) {
          byMethod[appt.payMethod] = (byMethod[appt.payMethod]||0) + t
        }
      })
    })
    return { totalIncome: total, incomeByProf: byProf, turnsByProf, incomeByMethod: byMethod, totalTurns: turns, incomeByService: byService, countByService: countService, incomeByDOW: byDOW }
  }, [safeAllData, safeProfessionals, rangeFrom, rangeTo])

  const avgTicket = totalTurns > 0 ? totalIncome / totalTurns : 0

  const gastosRange  = safeGastos.filter(g => inRange(g.fecha))
  const totalGastos  = gastosRange.reduce((s,g) => s+(parseFloat(g.monto)||0), 0)
  const netResult    = totalIncome - totalGastos
  const maxProf      = Math.max(...safeProfessionals.map(p => incomeByProf[p.id]||0), 1)

  // ── daily summary logic ──────────────────────────────────────────────────
  const dailySummary = useMemo(() => {
    if (!rangeFrom || !rangeTo) return []
    
    // Collect all date keys that have actual activity
    const activeKeys = new Set()
    
    // Add keys from appointments
    Object.entries(safeAllData).forEach(([dk, dayData]) => {
      if (dk >= rangeFrom && dk <= rangeTo) {
        const hasPaid = Object.values(dayData || {}).some(appt => appt?.paid)
        if (hasPaid || dayData?.closed) {
          activeKeys.add(dk)
        }
      }
    })
    
    // Add keys from expenses
    safeGastos.forEach(g => {
      if (g.fecha && g.fecha >= rangeFrom && g.fecha <= rangeTo) {
        activeKeys.add(g.fecha)
      }
    })
    
    const sortedKeys = Array.from(activeKeys).sort().reverse()
    
    return sortedKeys.map(dk => {
      const parts = dk.split("-").map(Number)
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
      const dayData = safeAllData[dk] || {}
      
      let totalFacturado = 0
      let efectivo = 0
      let debito = 0
      let mercadopago = 0
      let turnsCount = 0
      
      const profMap = {}
      safeProfessionals.forEach(p => {
        profMap[p.id] = {
          id: p.id,
          name: p.name,
          emoji: p.emoji,
          turnsCount: 0,
          total: 0,
          efectivo: 0,
          debito: 0,
          mercadopago: 0
        }
      })
      
      Object.values(dayData).forEach(appt => {
        if (appt?.paid) {
          totalFacturado += apptPaidTotal(appt)
          turnsCount += 1
          
          const profId = appt.profId
          if (profMap[profId]) {
            profMap[profId].turnsCount += 1
            const apptTotalPaid = apptPaidTotal(appt)
            profMap[profId].total += apptTotalPaid
            
            if (appt.paymentSplits?.length) {
              appt.paymentSplits.forEach(s => {
                const amt = parseFloat(s.amount) || 0
                if (s.methodId === "efectivo") {
                  efectivo += amt
                  profMap[profId].efectivo += amt
                } else if (s.methodId === "debito") {
                  debito += amt
                  profMap[profId].debito += amt
                } else if (s.methodId === "mercadopago") {
                  mercadopago += amt
                  profMap[profId].mercadopago += amt
                }
              })
            } else {
              const amt = apptTotal(appt) - (appt.discount || 0)
              const m = appt.payMethod || "efectivo"
              if (m === "efectivo") {
                efectivo += amt
                profMap[profId].efectivo += amt
              } else if (m === "debito") {
                debito += amt
                profMap[profId].debito += amt
              } else if (m === "mercadopago") {
                mercadopago += amt
                profMap[profId].mercadopago += amt
              }
            }
          }
        }
      })
      
      let dayReleasedTips = 0
      Object.values(dayData).forEach(appt => {
        if (appt?.paid && appt.tipReleased && (appt.tip || 0) > 0) {
          dayReleasedTips += appt.tip
        }
      })
      efectivo = Math.max(0, efectivo - dayReleasedTips)
      
      const dayGastos = safeGastos.filter(g => g.fecha === dk)
      const totalGastos = dayGastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0)
      const neto = totalFacturado - totalGastos
      
      return {
        dk,
        label: fmtDate(dk),
        dow: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][dateObj.getDay()],
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
        totalFacturado,
        efectivo,
        debito,
        mercadopago,
        totalGastos,
        neto,
        turnsCount,
        hasActivity: totalFacturado > 0 || totalGastos > 0 || !!dayData.closed,
        closed: !!dayData.closed,
        profBreakdown: Object.values(profMap).filter(p => p.turnsCount > 0)
      }
    })
  }, [rangeFrom, rangeTo, safeAllData, safeGastos, safeProfessionals])

  // ── period-based chart data ──────────────────────────────────────────────
  const chartRange = useMemo(() => {
    if (!rangeFrom || !rangeTo) return []
    const from = new Date(rangeFrom + "T12:00:00")
    const to = new Date(rangeTo + "T12:00:00")
    if (isNaN(from) || isNaN(to) || from > to) return []
    const days = []
    const cursor = new Date(from)
    while (cursor <= to) {
      days.push({ k: toDateKey(cursor), label: `${cursor.getDate()}/${cursor.getMonth()+1}` })
      cursor.setDate(cursor.getDate() + 1)
    }
    return days.length > 31 ? days.slice(-31) : days
  }, [rangeFrom, rangeTo])

  const dailyData = useMemo(() => {
    return chartRange.map(({ k, label }) => {
      const dayData = safeAllData[k] || {}
      const income = Object.values(dayData).filter(a => a?.paid).reduce((s, a) => s + apptPaidTotal(a), 0)
      return { k, label, income }
    })
  }, [chartRange, safeAllData])

  const maxDay = Math.max(...dailyData.map(d => d.income), 1)

  const turnosChart = useMemo(() => {
    return safeProfessionals.map((prof) => ({
      ...prof,
      values: chartRange.map(({ k }) =>
        Object.values(safeAllData[k] || {}).filter(a => a?.paid && a.profId === prof.id).reduce((s, a) => s + apptPaidTotal(a), 0)
      ),
    }))
  }, [safeProfessionals, safeAllData, chartRange])

  const maxTurns = Math.max(1, ...turnosChart.flatMap(p => p.values))
  const chartWidth = Math.max(320, chartRange.length * 24 + 48)
  const chartInnerWidth = chartWidth - 48
  const labelEvery = Math.max(1, Math.ceil(chartRange.length / 12))
  const topWorker = safeProfessionals.reduce((winner, prof) => {
    if (!winner) return prof
    return (incomeByProf[prof.id] || 0) > (incomeByProf[winner.id] || 0) ? prof : winner
  }, safeProfessionals[0] || null)
  const busiestDay = chartRange.reduce((best, current) => {
    const count = Object.values(safeAllData[current.k] || {}).filter(a => a?.paid).length
    if (!best || count > best.count) return { ...current, count }
    return best
  }, null)

  // ── sueldos ────────────────────────────────────────────────────────────────
  const sueldoKey   = (profId) => `${profId}||${sueldoPeriod}`
  const profSueldo  = (profId) => safeSueldos[sueldoKey(profId)] || { pagado:false, monto:"", fecha:"" }
  
  const getDailyBreakdown = (profId, diasFilter) => {
    const days = []
    Object.entries(safeAllData).forEach(([dk, dayData]) => {
      if (!dk.startsWith(sueldoPeriod)) return
      if (diasFilter && diasFilter !== "all" && !diasFilter.includes(dk)) return
      
      let dayFacturado = 0
      let dayTurnos = 0
      let dayPropinas = 0
      
      const safeDayData = dayData || {}
      Object.values(safeDayData).forEach(appt => {
        if (appt?.paid && appt.profId === profId) {
          dayFacturado += apptPaidTotal(appt)
          dayPropinas  += appt.tip || 0
          dayTurnos++
        }
      })
      
      if (dayTurnos > 0) {
        days.push({
          dk,
          dateLabel: fmtDate(dk),
          shortLabel: fmtShort(dk),
          turnos: dayTurnos,
          facturado: dayFacturado,
          comision: dayFacturado * (comisionPct/100),
          propinas: dayPropinas,
          total: (dayFacturado * (comisionPct/100)) + dayPropinas
        })
      }
    })
    return days.sort((a, b) => a.dk.localeCompare(b.dk))
  }

  const profStats = (profId, diasFilter) => {
    let facturado=0, turnos=0, propinas=0
    const diasSet = new Set()
    Object.entries(safeAllData).forEach(([dk, dayData]) => {
      if (!dk.startsWith(sueldoPeriod)) return
      // If diasFilter is set (not "all"), only count selected days
      if (diasFilter && diasFilter !== "all" && !diasFilter.includes(dk)) return
      const safeDayData = dayData || {}
      Object.values(safeDayData).forEach(appt => {
        if (appt?.paid && appt.profId === profId) {
          facturado += apptPaidTotal(appt)
          propinas  += appt.tip || 0
          turnos++
          diasSet.add(dk)
        }
      })
    })
    return { facturado, turnos, propinas, dias: diasSet.size, comision: facturado * (comisionPct/100) }
  }
  const earningsInMonth = (profId) => profStats(profId, "all").comision
  const changeSueldoMonth = (delta) => {
    const [y,m] = sueldoPeriod.split("-").map(Number)
    const d = new Date(y, m-1+delta, 1)
    setSueldoPeriod(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`)
  }

  // ── gasto handlers ─────────────────────────────────────────────────────────
  const saveGasto = () => {
    if (!gastoForm.descripcion.trim() || gastoForm.monto === "") return
    if (editGastoId) {
      setGastos(p => p.map(g => g.id===editGastoId ? {...g,...gastoForm} : g))
      setEditGastoId(null)
    } else {
      setGastos(p => [...p, { id:Date.now(), ...gastoForm }])
    }
    setGastoForm({ descripcion:"", monto:"", categoria:"insumos", fecha:todayKey() })
    setGastoModal(false)
  }
  const editGasto   = (g) => { setGastoForm({ descripcion:g.descripcion, monto:g.monto, categoria:g.categoria, fecha:g.fecha }); setEditGastoId(g.id); setGastoModal(true) }
  const deleteGasto = (id) => setGastos(p => p.filter(g => g.id!==id))

  const pagarSueldo    = (profId) => setSueldos(p => ({ ...p, [sueldoKey(profId)]: { pagado:true, monto:profSueldo(profId).monto, fecha:todayKey() } }))
  const desmarcarSueldo= (profId) => setSueldos(p => { const n={...p}; delete n[sueldoKey(profId)]; return n })

  const TABS = [{ id:"resumen", label:"📊 Resumen" }, { id:"diario", label:"📅 Detalle Diario" }, { id:"gastos", label:"💸 Gastos" }, { id:"sueldos", label:"👩 Sueldos" }]

  return (
    <div style={{ width:"100%", maxWidth:1440, margin:"0 auto", padding:"20px 24px 160px", boxSizing:"border-box" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .chart-card-zoom {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          cursor: zoom-in;
          position: relative;
        }
        .chart-card-zoom:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(58, 125, 68, 0.08) !important;
          border-color: ${C.green} !important;
        }
        .chart-card-zoom .zoom-badge {
          opacity: 0.4;
          transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
        }
        .chart-card-zoom:hover .zoom-badge {
          opacity: 1;
          transform: scale(1.03);
          background-color: #eaf7ed !important;
        }
        .zoom-modal-overlay {
          position: fixed;
          top: 58px;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 200;
          background: rgba(20,40,24,.4);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
          animation: fadeIn .18s ease;
        }
        @media (max-width: 768px) {
          .zoom-modal-overlay {
            bottom: 62px;
          }
        }
      ` }} />

      {/* Period selector */}
      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ fontSize:7, letterSpacing:"3px", color:C.orange, textTransform:"uppercase", marginRight:4 }}>Período</div>
        {[["dia","Hoy"],["semana","Semana"],["mes","Mes"],["todo","Todo"],["custom","Custom"]].map(([id,label]) => (
          <button key={id} onClick={()=>setContPeriod(id)} style={{ padding:"5px 14px", borderRadius:20, border:`1.5px solid ${contPeriod===id?C.green:C.border}`, background:contPeriod===id?`linear-gradient(135deg,${C.green},${C.greenLight})`:C.white, color:contPeriod===id?"#fff":C.textSoft, fontSize:10, cursor:"pointer", fontFamily:"Georgia,serif", transition:"all .15s" }}>{label}</button>
        ))}
        {contPeriod==="custom" && <>
          <input type="date" value={contFrom} onChange={e=>setContFrom(e.target.value)} style={{...inputStyle,width:"auto",fontSize:11}}/>
          <span style={{color:C.textSoft}}>→</span>
          <input type="date" value={contTo} onChange={e=>setContTo(e.target.value)} style={{...inputStyle,width:"auto",fontSize:11}}/>
        </>}
      </div>

      {/* Section pills */}
      <div style={{ display:"flex", gap:6, marginBottom:24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setSeccion(t.id)} style={{ padding:"7px 18px", borderRadius:20, border:`1.5px solid ${seccion===t.id?C.green:C.border}`, background:seccion===t.id?`linear-gradient(135deg,${C.green},${C.greenLight})`:C.white, color:seccion===t.id?"#fff":C.textSoft, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif", transition:"all .18s", boxShadow:seccion===t.id?`0 4px 12px rgba(58,125,68,.25)`:"none" }}>{t.label}</button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {seccion==="resumen" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(400px, 1fr))", gap:20, alignItems:"start" }}>

          {/* Col 1: KPIs & Totals */}
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:14 }}>
              {(() => {
                const fmtUSD = (v) => "US$ " + Math.round(v).toLocaleString("es-AR")
                return [
                  { label:"💰 Ingresos", val:totalIncome, bg:`linear-gradient(135deg,${C.green},${C.greenLight})`, sub:`${totalTurns} turnos` },
                  { label:"💵 Ingresos USD", val:totalIncome / dollarRate, bg:"linear-gradient(135deg,#1d4ed8,#3b82f6)", sub:`Cotización: 1 USD = $${Math.round(dollarRate)}`, isUSD: true },
                  { label:"💸 Gastos",   val:totalGastos, bg:`linear-gradient(135deg,${C.orange},${C.orangeLight})`, sub:`${gastosRange.length} registros` },
                  { label:"📈 Resultado",val:netResult,   bg:netResult>=0?`linear-gradient(135deg,#2d6a36,${C.green})`:`linear-gradient(135deg,#a03030,#c04040)`, sub:netResult>=0?"Positivo ✅":"Negativo ⚠️" },
                  { label:"🎫 Ticket Prom.", val:avgTicket, bg:`linear-gradient(135deg,${C.gold},${C.goldLight})`, sub:"Promedio por cliente" },
                ].map(({ label, val, bg, sub, isUSD }) => (
                  <div key={label} style={{ background:bg, borderRadius:16, padding:"18px 20px", color:"#fff", boxShadow:"0 8px 24px rgba(0,0,0,.12)" }}>
                    <div style={{ fontSize:8, letterSpacing:"1.5px", textTransform:"uppercase", opacity:.8, marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:24, fontWeight:"bold", letterSpacing:"-1px" }}>{isUSD ? fmtUSD(val) : fmt(val)}</div>
                    <div style={{ fontSize:9, opacity:.7, marginTop:4 }}>{sub}</div>
                  </div>
                ))
              })()}
            </div>

            <div style={{ background:C.white, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:12 }}>Quien trabajó más</div>
              {topWorker ? (
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:14, background:`linear-gradient(135deg,${C.greenPale},${C.greenMint})`, display:"grid", placeItems:"center", fontSize:22 }}>{topWorker.emoji}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:"bold", color:C.text }}>{topWorker.name}</div>
                    <div style={{ fontSize:11, color:C.textSoft }}>{turnsByProf[topWorker.id] || 0} turnos · {fmt(incomeByProf[topWorker.id] || 0)}</div>
                  </div>
                </div>
              ) : <div style={{ fontSize:11, color:C.textSoft }}>Sin datos</div>}
            </div>

            <div style={{ background:C.white, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:12 }}>Día más productivo</div>
              {busiestDay ? (
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:44, height:44, borderRadius:14, background:`linear-gradient(135deg,${C.mpPale},${C.mpMid})`, display:"grid", placeItems:"center", fontSize:18, color:C.white }}>📅</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:"bold", color:C.text }}>{busiestDay.label}</div>
                    <div style={{ fontSize:11, color:C.textSoft }}>{busiestDay.count} turnos pagados</div>
                  </div>
                </div>
              ) : <div style={{ fontSize:11, color:C.textSoft }}>Sin datos</div>}
            </div>
          </div>

          {/* Col 2: Performance Charts */}
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div 
              className="chart-card-zoom"
              onClick={() => setActiveZoomedChart("prof")}
              style={{ background:C.white, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase" }}>Ingresos por profesional</div>
                <div className="zoom-badge" style={{ fontSize: 9, color: C.green, background: "#f3faf5", padding: "2px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 3, fontWeight: "bold" }}>
                  <span>🔍</span> Ampliar
                </div>
              </div>
              <div style={{ width:"100%", display:"flex", justifyContent:"center" }}>
                <svg viewBox={`0 0 ${chartWidth} 220`} style={{ width:"100%", maxWidth:"100%", height:220, display:"block" }}>
                  {[...Array(6)].map((_, idx) => {
                    const y = 20 + idx * 36
                    return <line key={idx} x1={24} y1={y} x2={chartWidth - 24} y2={y} stroke="#f2f2f2" strokeWidth="1" />
                  })}
                  <path d={`M24 200 L${chartWidth - 24} 200`} stroke="#ddd" strokeWidth="1" />
                  {turnosChart.map((prof, idx) => {
                    const color = [C.green, C.orange, C.gold, C.greenLight, C.orangeLight][idx % 5]
                    const points = prof.values.map((value, i) => {
                      const x = 24 + (chartInnerWidth / Math.max(chartRange.length - 1, 1)) * i
                      const y = 200 - (value / maxTurns) * 160
                      return `${i===0?"M":"L"} ${x} ${y}`
                    }).join(" ")
                    return (
                      <g key={prof.id}>
                        <path d={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        {prof.values.map((value, i) => {
                          const x = 24 + (chartInnerWidth / Math.max(chartRange.length - 1, 1)) * i
                          const y = 200 - (value / maxTurns) * 160
                          return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />
                        })}
                      </g>
                    )
                  })}
                </svg>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:12 }}>
                {turnosChart.map((prof, idx) => (
                  <div key={prof.id} style={{ display:"flex", alignItems:"center", gap:5, fontSize:9, color:C.textSoft }}>
                    <span style={{ width:8, height:8, borderRadius:99, background:[C.green, C.orange, C.gold, C.greenLight, C.orangeLight][idx % 5] }}></span>
                    <span>{prof.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div 
              className="chart-card-zoom"
              onClick={() => setActiveZoomedChart("daily")}
              style={{ background:C.white, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}`, boxShadow:`0 2px 12px ${C.shadow}`, overflow:"hidden" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase" }}>Actividad diaria ({dailyData.length} d)</div>
                <div className="zoom-badge" style={{ fontSize: 9, color: C.green, background: "#f3faf5", padding: "2px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 3, fontWeight: "bold" }}>
                  <span>🔍</span> Ampliar
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:140, paddingBottom:20, position:"relative" }}>
                {dailyData.map((d, i) => {
                  const h = Math.max(2, (d.income / maxDay) * 120)
                  const isToday = d.k === todayKey()
                  const showLabel = dailyData.length <= 14 || i % Math.ceil(dailyData.length / 10) === 0 || i === dailyData.length - 1
                  return (
                    <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%", justifyContent:"flex-end", position:"relative" }}>
                      <div style={{ width:"100%", height:h, borderRadius:"2px 2px 0 0", background:isToday?`linear-gradient(180deg,${C.orange},${C.orangeLight})`:d.income>0?`linear-gradient(180deg,${C.green},${C.greenLight})`:"#f5f5f5", transition:"height .3s ease" }}/>
                      {showLabel && (
                        <div style={{ position:"absolute", bottom:-16, fontSize:7, color:isToday?C.orange:C.textSoft, fontWeight:isToday?"bold":"normal", whiteSpace:"nowrap" }}>{d.label}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div 
              className="chart-card-zoom"
              onClick={() => setActiveZoomedChart("dow")}
              style={{ background:C.white, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}` }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase" }}>Rendimiento por día de semana</div>
                <div className="zoom-badge" style={{ fontSize: 9, color: C.green, background: "#f3faf5", padding: "2px 8px", borderRadius: 8, display: "flex", alignItems: "center", gap: 3, fontWeight: "bold" }}>
                  <span>🔍</span> Ampliar
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", height:120, gap:8, paddingBottom:20 }}>
                {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map((label, dow) => {
                  const val = incomeByDOW[dow] || 0
                  const maxDOW = Math.max(...Object.values(incomeByDOW), 1)
                  const h = (val / maxDOW) * 80
                  return (
                    <div key={label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                      <div style={{ width:"100%", height:h, borderRadius:4, background:val>0?`linear-gradient(180deg,${C.green},${C.greenLight})`:"#f0f0f0", transition:"height .4s" }}/>
                      <div style={{ fontSize:8, color:C.textSoft }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Col 3: Breakdown Breakdown */}
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ background:C.white, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:14 }}>Top Servicios (Facturación)</div>
              {Object.entries(incomeByService)
                .sort(([,a],[,b]) => b-a)
                .slice(0, 5)
                .map(([name, val]) => {
                  const pct = totalIncome > 0 ? (val/totalIncome)*100 : 0
                  return (
                    <div key={name} style={{ marginBottom:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:11, color:C.text }}>{name} <span style={{ fontSize:9, color:C.textSoft }}>({countByService[name]})</span></span>
                        <span style={{ fontSize:11, fontWeight:"bold", color:C.green }}>{fmt(val)}</span>
                      </div>
                      <div style={{ height:5, background:"#f5f5f5", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:C.green, borderRadius:3, transition:"width .5s ease" }}/>
                      </div>
                    </div>
                  )
                })}
              {Object.keys(incomeByService).length === 0 && <div style={{ fontSize:11, color:C.textSoft }}>Sin datos</div>}
            </div>

            <div style={{ background:C.white, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:14 }}>Por método de pago</div>
              {PAYMENT_METHODS.map(pm => {
                const t = incomeByMethod[pm.id] || 0
                const pct = totalIncome > 0 ? (t/totalIncome)*100 : 0
                return (
                  <div key={pm.id} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:11, color:C.text }}>{pm.icon} {pm.label}</span>
                      <span style={{ fontSize:11, fontWeight:"bold", color:t>0?pm.color:C.textSoft }}>{fmt(t)}</span>
                    </div>
                    <div style={{ height:5, background:"#f5f5f5", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:pm.color, borderRadius:3, transition:"width .5s ease" }}/>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background:C.white, borderRadius:16, padding:"18px 20px", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:14 }}>Comisiones profesionales</div>
              {[...safeProfessionals]
                .sort((a, b) => (incomeByProf[b.id] || 0) - (incomeByProf[a.id] || 0))
                .map(p => {
                  const inc = incomeByProf[p.id] || 0
                  const com = inc * (comisionPct/100)
                  const pct = (inc/maxProf)*100
                  return (
                  <div key={p.id} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:11, color:C.text }}>{p.emoji} {p.name}</span>
                      <span style={{ fontSize:10, color:C.textSoft }}>{fmt(inc)} <span style={{ color:C.gold }}>· {fmt(com)}</span></span>
                    </div>
                    <div style={{ height:5, background:"#f5f5f5", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.green},${C.greenLight})`, borderRadius:3, transition:"width .5s ease" }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── GASTOS ── */}
      {seccion==="gastos" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:22, color:C.text, fontWeight:"bold" }}>{fmt(totalGastos)}</div>
              <div style={{ fontSize:10, color:C.textSoft }}>{gastosRange.length} gastos en el período</div>
            </div>
            <button onClick={()=>{ setGastoForm({ descripcion:"", monto:"", categoria:"insumos", fecha:todayKey() }); setEditGastoId(null); setGastoModal(true) }} style={{ padding:"9px 18px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${C.orange},${C.orangeLight})`, color:"#fff", fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif" }}>+ Registrar gasto</button>
          </div>

          {/* Bar chart gastos por categoría */}
          {gastosRange.length > 0 && (
            <div style={{ background:C.white, borderRadius:14, padding:"16px 18px", border:`1px solid ${C.border}`, marginBottom:16 }}>
              <div style={{ fontSize:9, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:12 }}>Por categoría</div>
              {GASTO_CATS.map(cat => {
                const total = gastosRange.filter(g=>g.categoria===cat.id).reduce((s,g)=>s+(parseFloat(g.monto)||0),0)
                if (total===0) return null
                const pct = (total/totalGastos)*100
                return (
                  <div key={cat.id} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:11, color:C.text }}>{cat.icon} {cat.label}</span>
                      <span style={{ fontSize:11, color:C.orange, fontWeight:"bold" }}>{fmt(total)} <span style={{ color:C.textSoft, fontWeight:"normal" }}>({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div style={{ height:7, background:"#f0f0f0", borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.orange},${C.orangeLight})`, borderRadius:4, transition:"width .4s" }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {gastosRange.length===0
            ? <div style={{ textAlign:"center", color:C.textSoft, fontSize:13, padding:40 }}>Sin gastos en este período</div>
            : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {gastosRange.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(g => {
                  const cat = GASTO_CATS.find(c=>c.id===g.categoria)
                  return (
                    <div key={g.id} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:13, color:C.text }}>{g.descripcion}</div>
                        <div style={{ fontSize:10, color:C.textSoft, marginTop:2 }}>{g.fecha} · {cat?.icon} {cat?.label}</div>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <div style={{ fontSize:15, fontWeight:"bold", color:C.orange }}>{fmt(g.monto)}</div>
                        <button onClick={()=>editGasto(g)} style={{ padding:"3px 8px", borderRadius:7, border:`1px solid ${C.border}`, background:C.white, fontSize:10, cursor:"pointer" }}>✏️</button>
                        <button onClick={()=>deleteGasto(g.id)} style={{ padding:"3px 8px", borderRadius:7, border:"none", background:"#fde8e8", color:"#c04040", fontSize:10, cursor:"pointer" }}>🗑️</button>
                      </div>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      )}

      {/* ── SUELDOS ── */}
      {seccion==="sueldos" && (
        <div>
          {/* Month nav */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
            <button onClick={()=>changeSueldoMonth(-1)} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${C.border}`, background:C.white, cursor:"pointer", fontFamily:"Georgia,serif" }}>‹</button>
            <div style={{ fontSize:16, color:C.text, fontWeight:"bold" }}>{MESES_ES[parseInt(sueldoPeriod.split("-")[1])-1]} {sueldoPeriod.split("-")[0]}</div>
            <button onClick={()=>changeSueldoMonth(1)} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${C.border}`, background:C.white, cursor:"pointer", fontFamily:"Georgia,serif" }}>›</button>
          </div>

          {/* Grid de profesionales */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
            {safeProfessionals.map(p => {
              const sd    = profSueldo(p.id)
              const selectedDays = sd.dias || "all"
              const stats = profStats(p.id, selectedDays)

              // Days of this month for day selector
              const [sy, sm] = sueldoPeriod.split("-").map(Number)
              const daysInMonth = new Date(sy, sm, 0).getDate()
              const allDays = Array.from({length: daysInMonth}, (_,i) => {
                const day = i+1
                const dk = `${sy}-${String(sm).padStart(2,"0")}-${String(day).padStart(2,"0")}`
                const d  = new Date(dk+"T12:00:00")
                return { day, dk, dow: d.getDay() }
              }).filter(d => d.dow !== 0) // exclude sundays

              const toggleDay = (dk) => {
                const curr = sd.dias || "all"
                let next
                if (curr === "all") {
                  next = allDays.map(d=>d.dk).filter(d=>d!==dk)
                } else {
                  next = curr.includes(dk) ? curr.filter(d=>d!==dk) : [...curr, dk]
                  if (next.length === allDays.length) next = "all"
                }
                setSueldos(p2=>({...p2,[sueldoKey(p.id)]:{...profSueldo(p.id), dias:next}}))
              }
              const isAllDays = selectedDays === "all"
              const activeDays = isAllDays ? allDays.length : (selectedDays?.length || 0)

              return (
                <div key={p.id} style={{ background:sd.pagado?C.greenPale:C.white, border:`2px solid ${sd.pagado?C.green:C.border}`, borderRadius:16, overflow:"hidden" }}>

                  {/* Header */}
                  <div style={{ padding:"14px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:sd.pagado?`linear-gradient(135deg,${C.green},${C.greenLight})`:"transparent" }}>
                    <div style={{ display:"flex", flexDirection:"column" }}>
                      <div style={{ fontSize:16, color:sd.pagado?"#fff":C.text, fontWeight:"bold" }}>{p.emoji} {p.name}</div>
                      <div style={{ fontSize:9, color:sd.pagado?"rgba(255,255,255,.8)":C.textSoft, marginTop:2 }}>{comisionPct}% comisión</div>
                    </div>
                    <button 
                      onClick={() => setReceiptProf(p)}
                      title="Ver Comprobante de Sueldo"
                      style={{
                        background: sd.pagado ? "rgba(255,255,255,0.2)" : C.greenPale,
                        color: sd.pagado ? "#fff" : C.green,
                        border: sd.pagado ? "1px solid rgba(255,255,255,0.4)" : `1px solid ${C.border}`,
                        borderRadius: 10,
                        padding: "6px 12px",
                        fontSize: 10,
                        fontWeight: "bold",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        transition: "all 0.15s ease",
                        fontFamily: "Georgia,serif"
                      }}
                    >
                      🧾 Recibo
                    </button>
                  </div>

                  <div style={{ padding:"14px 16px" }}>
                    {/* Stats grid */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                      {[
                        ["📅 Días trab.", activeDays, C.textSoft],
                        ["🎯 Turnos",     stats.turnos,  C.green],
                        ["💰 Facturado",  fmt(stats.facturado), C.orange],
                        ["🎁 Propinas",   fmt(stats.propinas),  C.gold],
                        ["✨ Comisión",   fmt(stats.comision),  C.green, true],
                      ].map(([label, val, col, wide]) => (
                        <div key={label} style={{ background:C.cream, borderRadius:8, padding:"6px 10px", gridColumn: wide?"1/-1":"auto" }}>
                          <div style={{ fontSize:8, color:C.textSoft, letterSpacing:"1px" }}>{label}</div>
                          <div style={{ fontSize:wide?16:13, fontWeight:"bold", color:col }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Day selector */}
                    <div style={{ marginBottom:12 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                        <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase" }}>Días a pagar</div>
                        <button onClick={() => setSueldos(p2=>({...p2,[sueldoKey(p.id)]:{...profSueldo(p.id), dias: isAllDays ? [] : "all"}}))} style={{ fontSize:8, color:isAllDays?C.green:C.textSoft, background:isAllDays?C.greenPale:"transparent", border:`1px solid ${isAllDays?C.green:C.border}`, borderRadius:6, padding:"2px 8px", cursor:"pointer", fontFamily:"Georgia,serif" }}>
                          {isAllDays?"✓ Mes completo":"Mes completo"}
                        </button>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                        {allDays.map(({day, dk, dow}) => {
                          const isSelected = isAllDays || (selectedDays?.includes(dk))
                          const hasWork = Object.values(safeAllData[dk]||{}).some(a=>a.paid&&a.profId===p.id)
                          return (
                            <button key={dk} onClick={()=>toggleDay(dk)} style={{
                              width:28, height:28, borderRadius:7, fontSize:9, fontFamily:"Georgia,serif",
                              border:`1.5px solid ${isSelected?C.green:C.border}`,
                              background: isSelected?(hasWork?`linear-gradient(135deg,${C.green},${C.greenLight})`:C.greenPale):"#f5f5f5",
                              color: isSelected?"#fff":C.textSoft,
                              cursor:"pointer", fontWeight:hasWork?"bold":"normal",
                              position:"relative",
                            }}>
                              {day}
                              {hasWork && isSelected && <div style={{ position:"absolute", bottom:1, left:"50%", transform:"translateX(-50%)", width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,.8)" }}/>}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Pago */}
                    {sd.pagado
                      ? <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:C.greenPale, borderRadius:10, padding:"10px 12px" }}>
                          <div style={{ fontSize:12, color:C.green }}>✅ Pagado {fmt(sd.monto)} — {sd.fecha}</div>
                          <button onClick={()=>desmarcarSueldo(p.id)} style={{ fontSize:10, color:C.textSoft, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontFamily:"Georgia,serif" }}>Desmarcar</button>
                        </div>
                      : <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <div style={{ position:"relative", flex:1 }}>
                            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:C.textSoft, fontSize:13 }}>$</span>
                            <input type="number" value={sd.monto} onChange={e=>setSueldos(p2=>({...p2,[sueldoKey(p.id)]:{...profSueldo(p.id),monto:e.target.value}}))} placeholder={String(Math.round(stats.comision))} style={{...inputStyle, paddingLeft:24, fontSize:13}}/>
                          </div>
                          <button onClick={()=>pagarSueldo(p.id)} disabled={sd.monto === ""} style={{ padding:"9px 14px", borderRadius:10, border:"none", background:sd.monto !== ""?`linear-gradient(135deg,${C.green},${C.greenLight})` : "#e8e8e8", color:sd.monto !== ""?"#fff":"#bbb", fontSize:10, cursor:sd.monto !== ""?"pointer":"not-allowed", fontFamily:"Georgia,serif", whiteSpace:"nowrap", flexShrink:0 }}>✅ Pagar</button>
                        </div>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* ── DETALLE DIARIO ── */}
      {seccion==="diario" && (
        <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"20px 24px", boxShadow:"0 8px 32px rgba(58,125,68,.05)", overflow:"hidden" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
            <div>
              <h2 style={{ margin:0, fontSize:16, color:C.text, fontFamily:"Georgia,serif" }}>Resumen Diario del Período</h2>
              <p style={{ margin:"4px 0 0", fontSize:11, color:C.textSoft }}>Desglose de ingresos por método de pago y neto real diario. Toca una fila con actividad para ver el detalle de cada profesional.</p>
            </div>
            <div style={{ fontSize:10, padding:"6px 12px", borderRadius:20, background:C.greenPale, color:C.green, fontWeight:"bold" }}>
              Período: {rangeFrom} → {rangeTo}
            </div>
          </div>

          <div style={{ overflowX:"auto", margin:"0 -24px", padding:"0 24px" }} className="date-carousel-scroll">
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
              <thead>
                <tr style={{ borderBottom:`2px solid ${C.border}`, textAlign:"left" }}>
                  <th style={{ padding:"12px 8px", fontSize:10, textTransform:"uppercase", color:C.textSoft, letterSpacing:"1px" }}>Fecha</th>
                  <th style={{ padding:"12px 8px", fontSize:10, textTransform:"uppercase", color:C.textSoft, letterSpacing:"1px" }}>Turnos</th>
                  <th style={{ padding:"12px 8px", fontSize:10, textTransform:"uppercase", color:C.textSoft, letterSpacing:"1px" }}>💵 Efectivo</th>
                  <th style={{ padding:"12px 8px", fontSize:10, textTransform:"uppercase", color:C.textSoft, letterSpacing:"1px" }}>💳 Débito</th>
                  <th style={{ padding:"12px 8px", fontSize:10, textTransform:"uppercase", color:C.textSoft, letterSpacing:"1px" }}>📲 Mercado Pago</th>
                  <th style={{ padding:"12px 8px", fontSize:10, textTransform:"uppercase", color:C.textSoft, letterSpacing:"1px" }}>💸 Gastos</th>
                  <th style={{ padding:"12px 8px", fontSize:10, textTransform:"uppercase", color:C.textSoft, letterSpacing:"1px", textAlign:"right" }}>📈 Neto Real</th>
                </tr>
              </thead>
              <tbody>
                {dailySummary.map(d => {
                  const isZero = !d.hasActivity
                  const isExpanded = !!expandedDates[d.dk]
                  return (
                    <React.Fragment key={d.dk}>
                      <tr 
                        onClick={() => !isZero && setExpandedDates(p => ({ ...p, [d.dk]: !p[d.dk] }))}
                        style={{ 
                          borderBottom:`1px solid ${C.greenPale}`, 
                          background: d.dk === todayKey() ? "#fdfaf6" : d.isWeekend ? "#fafcfa" : "transparent",
                          opacity: isZero ? 0.45 : 1,
                          cursor: isZero ? "default" : "pointer",
                          transition: "all .15s"
                        }}
                      >
                        {/* Fecha */}
                        <td style={{ padding:"14px 8px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {!isZero && (
                              <span style={{ 
                                fontSize:8, 
                                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", 
                                transition:"transform .15s", 
                                color:C.textSoft,
                                display:"inline-block"
                              }}>▶</span>
                            )}
                            <div style={{ fontSize:12, fontWeight:"bold", color: d.isWeekend ? C.textSoft : C.text, paddingLeft: isZero ? 14 : 0 }}>
                              {d.label} {d.dk === todayKey() && <span style={{ fontSize:9, color:C.orange, background:"#fdf0e8", padding:"2px 6px", borderRadius:8, marginLeft:4 }}>HOY</span>}
                            </div>
                          </div>
                          <div style={{ fontSize:9, color:C.textSoft, marginTop:2, paddingLeft: 14 }}>
                            {d.dow} {d.closed && "🔒 Cerrado"}
                          </div>
                        </td>

                        {/* Turnos */}
                        <td style={{ padding:"14px 8px", fontSize:12, color:C.text, fontWeight:"500" }}>
                          {d.turnsCount > 0 ? `${d.turnsCount} turnos` : "—"}
                        </td>

                        {/* Efectivo */}
                        <td style={{ padding:"14px 8px", fontSize:12, color: d.efectivo > 0 ? C.green : C.textSoft, fontWeight: d.efectivo > 0 ? "bold" : "normal" }}>
                          {d.efectivo > 0 ? fmt(d.efectivo) : "—"}
                        </td>

                        {/* Débito */}
                        <td style={{ padding:"14px 8px", fontSize:12, color: d.debito > 0 ? C.amber : C.textSoft, fontWeight: d.debito > 0 ? "bold" : "normal" }}>
                          {d.debito > 0 ? fmt(d.debito) : "—"}
                        </td>

                        {/* Mercado Pago */}
                        <td style={{ padding:"14px 8px", fontSize:12, color: d.mercadopago > 0 ? C.mp : C.textSoft, fontWeight: d.mercadopago > 0 ? "bold" : "normal" }}>
                          {d.mercadopago > 0 ? fmt(d.mercadopago) : "—"}
                        </td>

                        {/* Gastos */}
                        <td style={{ padding:"14px 8px", fontSize:12, color: d.totalGastos > 0 ? "#c04040" : C.textSoft, fontWeight: d.totalGastos > 0 ? "bold" : "normal" }}>
                          {d.totalGastos > 0 ? `-${fmt(d.totalGastos)}` : "—"}
                        </td>

                        {/* Neto */}
                        <td style={{ padding:"14px 8px", textAlign:"right" }}>
                          {isZero ? (
                            <span style={{ fontSize:12, color:C.textSoft }}>—</span>
                          ) : (
                            <span style={{ 
                              fontSize:12, 
                              fontWeight:"bold", 
                              color: d.neto >= 0 ? C.green : "#c04040",
                              background: d.neto >= 0 ? C.greenPale : "#fde8e8",
                              padding:"4px 10px",
                              borderRadius:10,
                              display:"inline-block"
                            }}>
                              {d.neto >= 0 ? `+${fmt(d.neto)}` : fmt(d.neto)}
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable row */}
                      {isExpanded && d.profBreakdown && d.profBreakdown.length > 0 && (
                        <tr style={{ background:"#fafdfb" }}>
                          <td colSpan={7} style={{ padding:"0px 24px 12px 24px", borderBottom:`1px solid ${C.greenPale}` }}>
                            <div style={{ 
                              background:"rgba(255, 255, 255, 0.9)", 
                              borderRadius:12, 
                              border:`1.5px solid ${C.greenMint}`, 
                              boxShadow:"inset 0 2px 6px rgba(58,125,68,.03), 0 4px 16px rgba(58,125,68,.04)",
                              overflow:"hidden",
                              padding:"12px 16px",
                              marginTop:4
                            }}>
                              <div style={{ fontSize:9, fontWeight:"bold", color:C.green, textTransform:"uppercase", letterSpacing:"1px", marginBottom:8, display:"flex", alignItems:"center", gap:4 }}>
                                <span>👩</span> Desglose por Profesional
                              </div>
                              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                {d.profBreakdown.map(p => (
                                  <div key={p.id} style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(100px, 1fr))", gap:10, alignItems:"center", fontSize:11, padding:"6px 0", borderBottom:`1.5px solid #f3faf5` }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:6, fontWeight:"bold", color:C.text }}>
                                      <span style={{ fontSize:13 }}>{p.emoji}</span>
                                      <span>{p.name}</span>
                                    </div>
                                    <div style={{ color:C.textSoft, fontSize:10 }}>{p.turnsCount} turnos</div>
                                    <div style={{ color: p.efectivo > 0 ? C.green : C.textSoft, fontSize:10 }}>💵 {p.efectivo > 0 ? fmt(p.efectivo) : "—"}</div>
                                    <div style={{ color: p.debito > 0 ? C.amber : C.textSoft, fontSize:10 }}>💳 {p.debito > 0 ? fmt(p.debito) : "—"}</div>
                                    <div style={{ color: p.mercadopago > 0 ? C.mp : C.textSoft, fontSize:10 }}>📲 {p.mercadopago > 0 ? fmt(p.mercadopago) : "—"}</div>
                                    <div style={{ textAlign:"right", fontWeight:"bold", color:C.green, fontSize:11 }}>
                                      Total: {fmt(p.total)} <span style={{ color:C.gold, fontSize:9, fontWeight:"500", marginLeft:4 }}>· Comi: {fmt(p.total * (comisionPct/100))}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ── Modal gasto ── */}
      {gastoModal && (
        <Overlay onClose={()=>{ setGastoModal(false); setEditGastoId(null) }}>
          <div style={modalBox}>
            <ModalHeader emoji="💸" sub={editGastoId?"Editar gasto":"Nuevo gasto"}>{editGastoId?"Modificar registro":"Registrar gasto"}</ModalHeader>
            <Field label="Fecha"><input type="date" value={gastoForm.fecha} onChange={e=>setGastoForm(p=>({...p,fecha:e.target.value}))} style={inputStyle}/></Field>
            <Field label="Descripción"><input value={gastoForm.descripcion} onChange={e=>setGastoForm(p=>({...p,descripcion:e.target.value}))} placeholder="Ej: Esmaltes, aceite cutícula..." style={inputStyle}/></Field>
            <Field label="Categoría">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {GASTO_CATS.map(cat => (
                  <button key={cat.id} onClick={()=>setGastoForm(p=>({...p,categoria:cat.id}))} style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${gastoForm.categoria===cat.id?C.orange:C.border}`, background:gastoForm.categoria===cat.id?"#fdf0e8":C.white, color:gastoForm.categoria===cat.id?C.orange:C.textSoft, fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif", textAlign:"left" }}>{cat.icon} {cat.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Monto">
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:C.textSoft, fontSize:13 }}>$</span>
                <input type="number" value={gastoForm.monto} onChange={e=>setGastoForm(p=>({...p,monto:e.target.value}))} placeholder="0" style={{...inputStyle,paddingLeft:24}}/>
              </div>
            </Field>
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <GhostBtn onClick={()=>{ setGastoModal(false); setEditGastoId(null) }}>Cancelar</GhostBtn>
              <SolidBtn onClick={saveGasto} disabled={!gastoForm.descripcion.trim() || gastoForm.monto === ""} color={C.orange}>{editGastoId?"✅ Guardar cambios":"💸 Registrar gasto"}</SolidBtn>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── Modal Recibo de Sueldo ── */}
      {receiptProf && (() => {
        const p = receiptProf
        const sd = profSueldo(p.id)
        const selectedDays = sd.dias || "all"
        const stats = profStats(p.id, selectedDays)
        const dailyBreakdown = getDailyBreakdown(p.id, selectedDays)
        
        // Month details for title
        const [sy, sm] = sueldoPeriod.split("-").map(Number)
        const monthName = MESES_ES[sm - 1]
        const periodLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${sy}`
        
        return (
          <>
            {/* Inject dynamic print stylesheet */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body { background: #ffffff !important; color: #000000 !important; }
                #root { display: none !important; }
                #printable-receipt-portal { display: block !important; position: absolute; left: 0; top: 0; width: 100% !important; margin: 0 !important; padding: 10px !important; box-sizing: border-box !important; }
                @page { margin: 1.5cm; }
              }
            ` }} />

            <Overlay onClose={() => setReceiptProf(null)}>
              <div style={{ 
                ...modalBox, 
                width: "min(400px, calc(100vw - 20px))", 
                padding: "20px 24px",
                position: "relative",
                background: C.white,
                borderRadius: 16,
                border: `1.5px solid ${C.border}`,
                boxShadow: "0 20px 60px rgba(58,125,68,0.15)"
              }}>
                
                {/* Visual Ticket header wrapper */}
                <div style={{ 
                  textAlign: "center", 
                  paddingBottom: 12, 
                  borderBottom: `1px dashed ${C.border}`,
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: C.text, fontFamily: "Georgia,serif" }}>
                    Comprobante de Sueldo
                  </div>
                  <div style={{ fontSize: 11, color: C.textSoft, marginTop: 4 }}>
                    {p.name} · {periodLabel}
                  </div>
                </div>

                {/* Daily Breakdown Table */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ maxHeight: 240, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.cream, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 10 }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", color: C.textSoft, fontSize: 10, textTransform: "uppercase" }}>Fecha</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", color: C.textSoft, fontSize: 10, textTransform: "uppercase", fontWeight: "bold" }}>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={2} style={{ padding: "20px 10px", textAlign: "center", color: C.textSoft }}>
                              Sin actividad registrada
                            </td>
                          </tr>
                        ) : (
                          dailyBreakdown.map(d => (
                            <tr key={d.dk} style={{ borderBottom: `1px solid #f3faf5` }}>
                              <td style={{ padding: "8px 10px", color: C.text }}>{d.shortLabel}</td>
                              <td style={{ padding: "8px 10px", textAlign: "right", color: C.green, fontWeight: "bold" }}>{fmt(d.comision)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Totals summary */}
                <div style={{ 
                  background: C.cream, 
                  borderRadius: 10, 
                  border: `1px solid ${C.border}`, 
                  padding: "12px 14px", 
                  marginBottom: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <span style={{ fontSize: 11, fontWeight: "bold", color: C.textSoft, letterSpacing: "1px" }}>
                    SUELDO NETO:
                  </span>
                  <span style={{ fontSize: 18, fontWeight: "bold", color: C.green }}>
                    {fmt(stats.comision)}
                  </span>
                </div>
                
                {sd.monto !== "" && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 10px 16px" }}>
                    <span style={{ fontSize: 10, color: C.textSoft }}>Monto Liquidado / Pagado:</span>
                    <span style={{ fontSize: 14, fontWeight: "bold", color: C.orange }}>{fmt(parseFloat(sd.monto) || 0)}</span>
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <GhostBtn onClick={() => setReceiptProf(null)}>Cerrar</GhostBtn>
                  <SolidBtn onClick={() => window.print()} color={C.green}>
                    Imprimir / PDF
                  </SolidBtn>
                </div>

              </div>
            </Overlay>

            {/* Print Portal - Rendered under document.body solely for printing */}
            {createPortal(
              <div id="printable-receipt-portal" style={{ display: "none" }}>
                <div style={{ 
                  fontFamily: "Georgia, serif", 
                  color: "#000000", 
                  width: "100%",
                  maxWidth: "400px",
                  margin: "0 auto",
                  padding: "10px"
                }}>
                  {/* Print Header */}
                  <div style={{ fontSize: "15px", fontWeight: "bold", borderBottom: "1.5px solid #000000", paddingBottom: "6px", marginBottom: "15px", textAlign: "left" }}>
                    Liquidación: {p.name} ({periodLabel})
                  </div>

                  {/* Print Table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "15px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1.5px solid #000000" }}>
                        <th style={{ padding: "6px 0", textAlign: "left", width: "60%" }}>Fecha</th>
                        <th style={{ padding: "6px 0", textAlign: "right", width: "40%", fontWeight: "bold" }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ padding: "15px 0", textAlign: "center" }}>
                            Sin actividad registrada.
                          </td>
                        </tr>
                      ) : (
                        dailyBreakdown.map(d => (
                          <tr key={d.dk} style={{ borderBottom: "1px solid #e0e0e0" }}>
                            <td style={{ padding: "6px 0" }}>{d.dateLabel}</td>
                            <td style={{ padding: "6px 0", textAlign: "right", fontWeight: "bold" }}>{fmt(d.comision)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Print Summary Box */}
                  <div style={{ 
                    borderTop: "2.5px solid #000000", 
                    paddingTop: "10px", 
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    pageBreakInside: "avoid"
                  }}>
                    <span style={{ fontWeight: "bold", fontSize: "13px" }}>SUELDO NETO:</span>
                    <span style={{ fontWeight: "bold", fontSize: "18px" }}>{fmt(stats.comision)}</span>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </>
        )
      })()}

      {/* ── Modal Zoom de Gráfico ── */}
      {activeZoomedChart && (
        <div
          onClick={e => e.target === e.currentTarget && setActiveZoomedChart(null)}
          className="zoom-modal-overlay"
        >
          <div style={{
            ...modalBox,
            width: "min(1200px, calc(100vw - 24px))",
            maxWidth: "1200px",
            maxHeight: "calc(100% - 32px)",
            padding: "20px 28px 24px",
            background: C.white,
            borderRadius: 20,
            boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            border: `1.5px solid ${C.greenMint}`
          }}>
            <ModalHeader 
              emoji="📊" 
              sub="Visualización detallada y ampliada"
            >
              {activeZoomedChart === "prof" ? "Ingresos por Profesional" :
               activeZoomedChart === "daily" ? "Actividad Diaria Detallada" :
               "Rendimiento por Día de Semana"}
            </ModalHeader>

            <div style={{ margin: "20px 0", width: "100%", overflowX: "auto" }}>
              {activeZoomedChart === "prof" && (() => {
                // Expanded Line SVG chart
                const zoomWidth = 960
                const zoomInnerWidth = zoomWidth - 100 // 860px wide charting space
                const zoomHeight = 360
                const zoomInnerHeight = 300 // 300px tall charting space

                // y grid helper
                const gridPoints = [...Array(6)].map((_, idx) => 30 + idx * 60) // 30, 90, 150, 210, 270, 330
                
                return (
                  <div style={{ display: "flex", gap: 20, alignItems: "stretch", flexWrap: "wrap" }}>
                    {/* Left: SVG container */}
                    <div style={{ 
                      flex: 1, 
                      minWidth: 500, 
                      background: C.cream, 
                      borderRadius: 14, 
                      padding: "20px 14px", 
                      border: `1.5px solid ${C.border}`, 
                      overflowX: "auto" 
                    }}>
                      <svg viewBox={`0 0 ${zoomWidth} ${zoomHeight}`} style={{ width: "100%", minWidth: 480, height: zoomHeight, display: "block" }}>
                        {/* Horizontal grid lines and Y-axis labels */}
                        {gridPoints.map((yVal, idx) => {
                          const value = Math.round(maxTurns - (idx / 5) * maxTurns)
                          return (
                            <g key={idx}>
                              <line x1={80} y1={yVal} x2={zoomWidth - 20} y2={yVal} stroke="#e4ebe6" strokeWidth="1" strokeDasharray="3 3" />
                              <text x={70} y={yVal + 4} fill={C.textSoft} fontSize="10" textAnchor="end" fontFamily="monospace">
                                {fmt(value)}
                              </text>
                            </g>
                          )
                        })}

                        {/* Baseline */}
                        <line x1={80} y1={330} x2={zoomWidth - 20} y2={330} stroke="#cbd5ce" strokeWidth="1.5" />

                        {/* Professional lines */}
                        {turnosChart.map((prof, idx) => {
                          const color = [C.green, C.orange, C.gold, C.greenLight, C.orangeLight][idx % 5]
                          const isFocused = hoveredProfId === null || hoveredProfId === prof.id
                          const opacity = isFocused ? 1 : 0.08
                          const strokeWidth = hoveredProfId === prof.id ? 4.5 : 3.5

                          const points = prof.values.map((value, i) => {
                            const x = 80 + (zoomInnerWidth / Math.max(chartRange.length - 1, 1)) * i
                            const y = 330 - (value / maxTurns) * 300
                            return `${i === 0 ? "M" : "L"} ${x} ${y}`
                          }).join(" ")

                          return (
                            <g key={prof.id} style={{ opacity, transition: "opacity 0.2s ease" }}>
                              <path d={points} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                              {prof.values.map((value, i) => {
                                const x = 80 + (zoomInnerWidth / Math.max(chartRange.length - 1, 1)) * i
                                const y = 330 - (value / maxTurns) * 300
                                const isLabelVisible = value > 0 && (chartRange.length <= 15 || i % Math.ceil(chartRange.length / 10) === 0)
                                return (
                                  <g key={i}>
                                    <circle cx={x} cy={y} r={hoveredProfId === prof.id ? "6.5" : "5.5"} fill={color} stroke={C.white} strokeWidth="1.5" />
                                    {isLabelVisible && (
                                      <text x={x} y={y - 10} fill={color} fontSize="9" fontWeight="bold" textAnchor="middle" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: "3px" }}>
                                        {fmt(value)}
                                      </text>
                                    )}
                                  </g>
                                )
                              })}
                            </g>
                          )
                        })}

                        {/* Bottom X-axis Date labels */}
                        {chartRange.map((d, i) => {
                          const x = 80 + (zoomInnerWidth / Math.max(chartRange.length - 1, 1)) * i
                          const showLabel = chartRange.length <= 16 || i % Math.ceil(chartRange.length / 12) === 0 || i === chartRange.length - 1
                          if (!showLabel) return null
                          return (
                            <g key={i}>
                              <text x={x} y={352} fill={C.textSoft} fontSize="9" textAnchor="middle" fontWeight="bold">
                                {d.label}
                              </text>
                              <line x1={x} y1={330} x2={x} y2={334} stroke="#cbd5ce" strokeWidth="1" />
                            </g>
                          )
                        })}
                      </svg>
                    </div>

                    {/* Right Side: Summary legend */}
                    <div style={{ 
                      width: 250, 
                      flexShrink: 0, 
                      background: "#f3faf5", 
                      borderRadius: 14, 
                      padding: "18px 16px", 
                      border: `1.5px solid ${C.greenMint}`,
                      display: "flex",
                      flexDirection: "column"
                    }}>
                      <div style={{ fontSize: 9, fontWeight: "bold", color: C.green, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
                        Totales acumulados
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {turnosChart.map((prof, idx) => {
                          const color = [C.green, C.orange, C.gold, C.greenLight, C.orangeLight][idx % 5]
                          const totalEarned = incomeByProf[prof.id] || 0
                          const totalTurnsCount = turnsByProf[prof.id] || 0
                          const isHovered = hoveredProfId === prof.id
                          return (
                            <div 
                              key={prof.id}
                              onMouseEnter={() => setHoveredProfId(prof.id)}
                              onMouseLeave={() => setHoveredProfId(null)}
                              style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                gap: 10, 
                                background: isHovered ? "#f3faf5" : C.white, 
                                padding: "10px 12px", 
                                borderRadius: 10, 
                                border: `1.5px solid ${isHovered ? color : C.border}`,
                                transition: "all 0.15s ease",
                                cursor: "pointer",
                                transform: isHovered ? "translateX(-2px)" : "none",
                                boxShadow: isHovered ? "0 4px 10px rgba(58,125,68,0.06)" : "none"
                              }}
                            >
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: "bold", color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prof.emoji} {prof.name}</div>
                                <div style={{ fontSize: 9, color: C.textSoft, marginTop: 1 }}>{totalTurnsCount} turnos · <span style={{ fontWeight: "bold", color: C.green }}>{fmt(totalEarned)}</span></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {activeZoomedChart === "daily" && (() => {
                // Expanded Daily Activity chart
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ 
                      background: C.cream, 
                      borderRadius: 14, 
                      padding: "24px 20px 30px", 
                      border: `1.5px solid ${C.border}`,
                      overflowX: "auto"
                    }}>
                      <div style={{ 
                        display: "flex", 
                        alignItems: "flex-end", 
                        justifyContent: dailyData.length > 20 ? "flex-start" : "center",
                        gap: dailyData.length > 20 ? 4 : 12, 
                        height: 300, 
                        paddingBottom: 24, 
                        position: "relative",
                        minWidth: dailyData.length * 28 + 40,
                        margin: "0 auto"
                      }}>
                        {dailyData.map((d, i) => {
                          const h = Math.max(4, (d.income / maxDay) * 250)
                          const isToday = d.k === todayKey()
                          const hasIncome = d.income > 0
                          const labelEveryN = Math.ceil(dailyData.length / 15)
                          const showLabel = dailyData.length <= 15 || i % labelEveryN === 0 || i === dailyData.length - 1
                          
                          return (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative" }}>
                              {/* Income Value Indicator */}
                              {hasIncome && (
                                <div style={{ 
                                  position: "absolute", 
                                  bottom: h + 28, 
                                  fontSize: 8, 
                                  color: isToday ? C.orange : C.green, 
                                  fontWeight: "bold",
                                  background: isToday ? "#fdf0e8" : "#f0f8f2",
                                  padding: "2px 5px",
                                  borderRadius: 6,
                                  whiteSpace: "nowrap",
                                  boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                                  border: `1px solid ${isToday ? C.orangeLight : C.greenMint}`
                                }}>
                                  {fmt(d.income)}
                                </div>
                              )}
                              {/* Bar */}
                              <div style={{ 
                                width: "100%", 
                                height: h, 
                                borderRadius: "4px 4px 0 0", 
                                background: isToday 
                                  ? `linear-gradient(180deg, ${C.orange}, ${C.orangeLight})` 
                                  : hasIncome 
                                    ? `linear-gradient(180deg, ${C.green}, ${C.greenLight})` 
                                    : "#e4ebe6", 
                                transition: "height .3s ease",
                                boxShadow: hasIncome ? "0 2px 6px rgba(58,125,68,0.1)" : "none"
                              }}/>
                              {/* Bottom labels */}
                              {showLabel && (
                                <div style={{ 
                                  position: "absolute", 
                                  bottom: -22, 
                                  fontSize: 9, 
                                  color: isToday ? C.orange : C.textSoft, 
                                  fontWeight: isToday ? "bold" : "600", 
                                  whiteSpace: "nowrap" 
                                }}>
                                  {d.label}
                                  {isToday && <span style={{ fontSize: 7, marginLeft: 2, background: C.orange, color: "#fff", padding: "1px 3px", borderRadius: 4 }}>Hoy</span>}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ background: "#fdf8f4", border: `1px solid ${C.orangeLight}`, flex: 1, padding: "12px 16px", borderRadius: 12 }}>
                        <span style={{ fontSize: 9, textTransform: "uppercase", color: C.orange, fontWeight: "bold", letterSpacing: "1px" }}>Día más productivo</span>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: C.text, marginTop: 4 }}>
                          {busiestDay ? `${busiestDay.label} · ${busiestDay.count} turnos` : "Sin datos"}
                        </div>
                      </div>
                      <div style={{ background: "#f4fcf7", border: `1px solid ${C.greenMint}`, flex: 1, padding: "12px 16px", borderRadius: 12 }}>
                        <span style={{ fontSize: 9, textTransform: "uppercase", color: C.green, fontWeight: "bold", letterSpacing: "1px" }}>Total del Período</span>
                        <div style={{ fontSize: 16, fontWeight: "bold", color: C.green, marginTop: 4 }}>
                          {fmt(totalIncome)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {activeZoomedChart === "dow" && (() => {
                // Expanded Day of Week Performance chart
                const daysMap = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
                const maxDOW = Math.max(...Object.values(incomeByDOW), 1)

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ 
                      background: C.cream, 
                      borderRadius: 14, 
                      padding: "36px 24px 30px", 
                      border: `1.5px solid ${C.border}`,
                      display: "flex",
                      justifyContent: "center"
                    }}>
                      <div style={{ 
                        display: "flex", 
                        alignItems: "flex-end", 
                        justifyContent: "center", 
                        height: 260, 
                        gap: 32, // premium spacing
                        paddingBottom: 24,
                        width: "100%",
                        maxWidth: 760
                      }}>
                        {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map((label, dow) => {
                          const val = incomeByDOW[dow] || 0
                          const h = (val / maxDOW) * 190
                          const pct = totalIncome > 0 ? (val / totalIncome) * 100 : 0
                          
                          return (
                            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end", position: "relative" }}>
                              {val > 0 && (
                                <div style={{ 
                                  position: "absolute", 
                                  bottom: h + 28, 
                                  textAlign: "center", 
                                  display: "flex", 
                                  flexDirection: "column", 
                                  alignItems: "center" 
                                }}>
                                  <span style={{ fontSize: 10, fontWeight: "bold", color: C.green }}>{fmt(val)}</span>
                                  <span style={{ fontSize: 8, color: C.textSoft, background: "#f0f8f2", padding: "1px 4px", borderRadius: 4, marginTop: 2 }}>{pct.toFixed(1)}%</span>
                                </div>
                              )}
                              <div style={{ 
                                width: "100%", 
                                maxWidth: 50, 
                                height: Math.max(4, h), 
                                borderRadius: "6px 6px 0 0", 
                                background: val > 0 
                                  ? `linear-gradient(180deg, ${C.green}, ${C.greenLight})` 
                                  : "#e4ebe6", 
                                transition: "height .4s",
                                boxShadow: val > 0 ? "0 4px 10px rgba(58,125,68,0.15)" : "none"
                              }}/>
                              <div style={{ fontSize: 10, color: C.text, fontWeight: "bold" }}>{daysMap[dow]}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <GhostBtn onClick={() => setActiveZoomedChart(null)} style={{ padding: "10px 24px", fontSize: 12 }}>
                Cerrar Ventana
              </GhostBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
