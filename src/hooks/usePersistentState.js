import { useState, useEffect, useRef } from "react"
import { CONFIG_DEFAULT } from "../constants/data.js"

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const TABLE         = "perlaverde_data"

async function dbRead(id) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=data`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }, signal: controller.signal }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0]?.data ?? null
  } catch(e) {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function dbWrite(id, data, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method: "POST",
        headers: {
          apikey:         SUPABASE_ANON,
          Authorization:  `Bearer ${SUPABASE_ANON}`,
          "Content-Type": "application/json",
          Prefer:         "resolution=merge-duplicates",
        },
        body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }),
      })
      if (res.ok || res.status === 201 || res.status === 200) return true
      // Si falla, esperar antes de reintentar
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    } catch(e) {
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw new Error(`No se pudo guardar ${id} después de ${retries} intentos`)
}

async function loadAll() {
  const [ad, gs, ss, cf, cl] = await Promise.all([
    dbRead("allData"),
    dbRead("gastos"),
    dbRead("sueldos"),
    dbRead("config"),
    dbRead("clientes"),
  ])
  return { ad, gs, ss, cf, cl }
}

export function usePersistentState() {
  const pausePolling = useRef(false)
  const [loaded,     setLoaded]     = useState(false)
  const hasLoaded    = useRef(false)
  const [saveStatus, setSaveStatus] = useState("idle")
  const [allData,    setAllData]    = useState({})
  const [gastos,     setGastos]     = useState([])
  const [sueldos,    setSueldos]    = useState({})
  const [config,     setConfig]     = useState(CONFIG_DEFAULT)
  const [clientes,   setClientes]   = useState([])
  const saveTimer    = useRef(null)
  const initialized  = useRef(false)
  const wsRef        = useRef(null)

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!hasLoaded.current) {
        console.warn("Supabase tardó demasiado — cargando con datos vacíos")
        setLoaded(true)
        hasLoaded.current = true
        initialized.current = true
      }
    }, 7000)

    loadAll().then(({ ad, gs, ss, cf, cl }) => {
      if (ad && typeof ad === "object" && !Array.isArray(ad)) setAllData(ad)
      if (Array.isArray(gs)) setGastos(gs)
      if (ss && typeof ss === "object" && !Array.isArray(ss)) setSueldos(ss)
      if (cf && typeof cf === "object" && !Array.isArray(cf)) setConfig(prev => ({ ...prev, ...cf }))
      if (Array.isArray(cl)) setClientes(cl)
      setLoaded(true)
      hasLoaded.current = true
      initialized.current = true
    }).catch(e => {
      console.error("Error cargando datos:", e)
      setLoaded(true)
      hasLoaded.current = true
      initialized.current = true
    }).finally(() => clearTimeout(fallback))
  }, [])

  // ── Auto-save debounced 1.5s con reintentos ───────────────────────────────
  useEffect(() => {
    if (!initialized.current) return
    setSaveStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        // Guardar uno por uno para detectar cuál falla
        await dbWrite("allData",  allData)
        await dbWrite("gastos",   gastos)
        await dbWrite("sueldos",  sueldos)
        await dbWrite("config",   config)
        await dbWrite("clientes", clientes)
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2200)
      } catch (e) {
        console.error("Error guardando:", e)
        setSaveStatus("error")
        // Reintentar en 5 segundos si falla
        saveTimer.current = setTimeout(async () => {
          try {
            await dbWrite("allData",  allData)
            await dbWrite("gastos",   gastos)
            await dbWrite("sueldos",  sueldos)
            await dbWrite("config",   config)
            await dbWrite("clientes", clientes)
            setSaveStatus("saved")
            setTimeout(() => setSaveStatus("idle"), 2200)
          } catch(e2) {
            console.error("Reintento fallido:", e2)
            setSaveStatus("error")
          }
        }, 5000)
      }
    }, 1500)
    return () => clearTimeout(saveTimer.current)
  }, [allData, gastos, sueldos, config, clientes])

  return {
    loaded, saveStatus,
    allData,   setAllData,
    gastos,    setGastos,
    sueldos,   setSueldos,
    config,    setConfig,
    clientes,  setClientes,
    pausePolling,
  }
}
