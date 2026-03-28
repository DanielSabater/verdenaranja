import { useState, useEffect, useRef } from "react"
import { CONFIG_DEFAULT } from "../constants/data.js"

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const TABLE         = "perlaverde_data"

async function dbRead(id) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=data`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }, signal: controller.signal }
    )
    const rows = await res.json()
    return rows?.[0]?.data ?? null
  } catch(e) {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function dbWrite(id, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      apikey:         SUPABASE_ANON,
      Authorization:  `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer:         "resolution=merge-duplicates",
    },
    body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }),
  })
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
  const hasLoaded = useRef(false)
  const [saveStatus, setSaveStatus] = useState("idle")
  const [allData,    setAllData]    = useState({})
  const [gastos,     setGastos]     = useState([])
  const [sueldos,    setSueldos]    = useState({})
  const [config,     setConfig]     = useState(CONFIG_DEFAULT)
  const [clientes,   setClientes]   = useState([])
  const saveTimer   = useRef(null)
  const initialized = useRef(false)
  const wsRef       = useRef(null)

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Fallback: if Supabase takes too long, load anyway
    const fallback = setTimeout(() => {
      if (!hasLoaded.current) {
        setLoaded(true)
        hasLoaded.current = true
        initialized.current = true
      }
    }, 6000)

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

  // Polling desactivado para no saturar Supabase free tier
  // Los datos se sincronizan al cargar la página

  // ── Auto-save debounced 1s ────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized.current) return
    setSaveStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await Promise.all([
          dbWrite("allData",  allData),
          dbWrite("gastos",   gastos),
          dbWrite("sueldos",  sueldos),
          dbWrite("config",   config),
          dbWrite("clientes", clientes),
        ])
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2200)
      } catch (e) {
        console.error("Error guardando:", e)
        setSaveStatus("error")
      }
    }, 1000)
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
