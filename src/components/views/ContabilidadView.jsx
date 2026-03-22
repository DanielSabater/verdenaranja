import { useState, useMemo } from "react"
import { C } from "../../constants/colors.js"
import { PAYMENT_METHODS, GASTO_CATS } from "../../constants/data.js"
import { fmt, apptTotal } from "../../utils/appointments.js"
import { fmtDate, todayKey, toDateKey, MESES_ES } from "../../utils/dates.js"
import { Overlay, ModalHeader, Field, GhostBtn, SolidBtn, inputStyle, modalBox } from "../ui/index.jsx"

export default function ContabilidadView({
  allData, professionals, comisionPct, gastos, setGastos,
  gastoModal, setGastoModal, gastoForm, setGastoForm, editGastoId, setEditGastoId,
  sueldos, setSueldos, sueldoPeriod, setSueldoPeriod,
  contPeriod, setContPeriod, contFrom, setContFrom, contTo, setContTo,
}) {
  const [seccion, setSeccion] = useState("resumen")

  const safeAllData       = allData       || {}
  const safeGastos        = gastos        || []
  const safeSueldos       = sueldos       || {}
  const safeProfessionals = professionals || []

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
  const { totalIncome, incomeByProf, incomeByMethod } = useMemo(() => {
    const byProf = {}, byMethod = {}
    safeProfessionals.forEach(p => { byProf[p.id] = 0 })
    let total = 0
    Object.entries(safeAllData).forEach(([dk, dayData]) => {
      if (!inRange(dk)) return
      Object.values(dayData).forEach(appt => {
        if (!appt.paid) return
        const t = apptTotal(appt)
        total += t
        byProf[appt.profId] = (byProf[appt.profId] || 0) + t
        if (appt.paymentSplits?.length) {
          appt.paymentSplits.forEach(s => { byMethod[s.methodId] = (byMethod[s.methodId]||0) + (parseFloat(s.amount)||0) })
        } else if (appt.payMethod) {
          byMethod[appt.payMethod] = (byMethod[appt.payMethod]||0) + t
        }
      })
    })
    return { totalIncome: total, incomeByProf: byProf, incomeByMethod: byMethod }
  }, [safeAllData, safeProfessionals, rangeFrom, rangeTo])

  const gastosRange  = safeGastos.filter(g => inRange(g.fecha))
  const totalGastos  = gastosRange.reduce((s,g) => s+(parseFloat(g.monto)||0), 0)
  const netResult    = totalIncome - totalGastos
  const maxProf      = Math.max(...safeProfessionals.map(p => incomeByProf[p.id]||0), 1)

  // ── daily income for bar chart (last 14 days) ──────────────────────────────
  const dailyData = useMemo(() => {
    const days = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const k = toDateKey(d)
      const dayData = safeAllData[k] || {}
      const income = Object.values(dayData).filter(a=>a.paid).reduce((s,a)=>s+apptTotal(a),0)
      days.push({ k, label: `${d.getDate()}/${d.getMonth()+1}`, income })
    }
    return days
  }, [safeAllData])
  const maxDay = Math.max(...dailyData.map(d=>d.income), 1)

  // ── sueldos ────────────────────────────────────────────────────────────────
  const sueldoKey   = (profId) => `${profId}||${sueldoPeriod}`
  const profSueldo  = (profId) => safeSueldos[sueldoKey(profId)] || { pagado:false, monto:"", fecha:"" }
  const profStats = (profId, diasFilter) => {
    let facturado=0, turnos=0, propinas=0
    const diasSet = new Set()
    Object.entries(safeAllData).forEach(([dk, dayData]) => {
      if (!dk.startsWith(sueldoPeriod)) return
      // If diasFilter is set (not "all"), only count selected days
      if (diasFilter && diasFilter !== "all" && !diasFilter.includes(dk)) return
      Object.values(dayData).forEach(appt => {
        if (appt.paid && appt.profId === profId) {
          facturado += apptTotal(appt)
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
    if (!gastoForm.descripcion.trim() || !gastoForm.monto) return
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

  const TABS = [{ id:"resumen", label:"📊 Resumen" }, { id:"gastos", label:"💸 Gastos" }, { id:"sueldos", label:"👩 Sueldos" }]

  return (
    <div style={{ maxWidth:960, margin:"0 auto", padding:"20px 16px 160px" }}>

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
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

          {/* KPI cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
            {[
              { label:"💰 Ingresos", val:totalIncome, bg:`linear-gradient(135deg,${C.green},${C.greenLight})`, sub:`${Object.values(safeAllData).flatMap(d=>Object.values(d)).filter(a=>a.paid&&inRange(Object.entries(safeAllData).find(([,v])=>Object.values(v).includes(a))?.[0]||"")).length} turnos pagados` },
              { label:"💸 Gastos",   val:totalGastos, bg:`linear-gradient(135deg,${C.orange},${C.orangeLight})`, sub:`${gastosRange.length} registros` },
              { label:"📈 Resultado",val:netResult,   bg:netResult>=0?`linear-gradient(135deg,#2d6a36,${C.green})`:`linear-gradient(135deg,#a03030,#c04040)`, sub:netResult>=0?"Período positivo ✅":"Período negativo ⚠️" },
            ].map(({ label, val, bg, sub }) => (
              <div key={label} style={{ background:bg, borderRadius:16, padding:"20px 22px", color:"#fff", boxShadow:"0 8px 24px rgba(0,0,0,.12)" }}>
                <div style={{ fontSize:9, letterSpacing:"2px", textTransform:"uppercase", opacity:.8, marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:28, fontWeight:"bold", letterSpacing:"-1px" }}>{fmt(val)}</div>
                <div style={{ fontSize:10, opacity:.7, marginTop:4 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Bar chart — últimos 14 días */}
          <div style={{ background:C.white, borderRadius:16, padding:"20px 22px", border:`1px solid ${C.border}`, boxShadow:`0 2px 12px ${C.shadow}` }}>
            <div style={{ fontSize:9, letterSpacing:"3px", color:C.textSoft, textTransform:"uppercase", marginBottom:16 }}>Ingresos últimos 14 días</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:100 }}>
              {dailyData.map((d, i) => {
                const h = Math.max(2, (d.income / maxDay) * 90)
                const isToday = d.k === toDateKey(new Date())
                return (
                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    {d.income > 0 && (
                      <div style={{ fontSize:7, color:C.textSoft, whiteSpace:"nowrap" }}>{fmt(d.income).replace("$","")}</div>
                    )}
                    <div style={{ width:"100%", height:h, borderRadius:"4px 4px 0 0", background:isToday?`linear-gradient(180deg,${C.orange},${C.orangeLight})`:d.income>0?`linear-gradient(180deg,${C.green},${C.greenLight})`:"#f0f0f0", transition:"height .3s ease", position:"relative" }}/>
                    <div style={{ fontSize:7, color:isToday?C.orange:C.textSoft, fontWeight:isToday?"bold":"normal" }}>{d.label}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por método + por profesional */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>

            {/* Métodos */}
            <div style={{ background:C.white, borderRadius:16, padding:"20px 22px", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, letterSpacing:"3px", color:C.textSoft, textTransform:"uppercase", marginBottom:14 }}>Por método de pago</div>
              {PAYMENT_METHODS.map(pm => {
                const t = incomeByMethod[pm.id] || 0
                const pct = totalIncome > 0 ? (t/totalIncome)*100 : 0
                return (
                  <div key={pm.id} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:11, color:C.text }}>{pm.icon} {pm.label}</span>
                      <span style={{ fontSize:11, fontWeight:"bold", color:t>0?pm.color:C.textSoft }}>{fmt(t)}</span>
                    </div>
                    <div style={{ height:6, background:"#f0f0f0", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:pm.color, borderRadius:3, transition:"width .4s ease" }}/>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Profesionales */}
            <div style={{ background:C.white, borderRadius:16, padding:"20px 22px", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:9, letterSpacing:"3px", color:C.textSoft, textTransform:"uppercase", marginBottom:14 }}>Por profesional</div>
              {safeProfessionals.map(p => {
                const inc = incomeByProf[p.id] || 0
                const com = inc * (comisionPct/100)
                const pct = (inc/maxProf)*100
                return (
                  <div key={p.id} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:11, color:C.text }}>{p.emoji} {p.name}</span>
                      <span style={{ fontSize:10, color:C.textSoft }}>{fmt(inc)} <span style={{ color:C.gold }}>· {fmt(com)}</span></span>
                    </div>
                    <div style={{ height:6, background:"#f0f0f0", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.green},${C.greenLight})`, borderRadius:3, transition:"width .4s ease" }}/>
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
                    <div style={{ fontSize:16, color:sd.pagado?"#fff":C.text }}>{p.emoji} {p.name}</div>
                    <div style={{ fontSize:10, color:sd.pagado?"rgba(255,255,255,.8)":C.textSoft }}>{comisionPct}% comisión</div>
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
                          <button onClick={()=>pagarSueldo(p.id)} disabled={!sd.monto} style={{ padding:"9px 14px", borderRadius:10, border:"none", background:sd.monto?`linear-gradient(135deg,${C.green},${C.greenLight})`:"#e8e8e8", color:sd.monto?"#fff":"#bbb", fontSize:10, cursor:sd.monto?"pointer":"not-allowed", fontFamily:"Georgia,serif", whiteSpace:"nowrap", flexShrink:0 }}>✅ Pagar</button>
                        </div>
                    }
                  </div>
                </div>
              )
            })}
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
              <SolidBtn onClick={saveGasto} disabled={!gastoForm.descripcion.trim()||!gastoForm.monto} color={C.orange}>{editGastoId?"✅ Guardar cambios":"💸 Registrar gasto"}</SolidBtn>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}
