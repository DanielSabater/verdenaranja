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
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=data,updated_at`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }, signal: controller.signal }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0] ?? null  // returns {data, updated_at}
  } catch(e) {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function dbWrite(id, data, retries = 3) {
  const updated_at = new Date().toISOString()
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
        body: JSON.stringify({ id, data, updated_at }),
      })
      if (res.ok || res.status === 201 || res.status === 200) return true
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
  const pausePolling  = useRef(false)
  const [loaded,      setLoaded]     = useState(false)
  const hasLoaded     = useRef(false)
  const [saveStatus,  setSaveStatus] = useState("idle")
  const [allData,     setAllData]    = useState({})
  const [gastos,      setGastos]     = useState([])
  const [sueldos,     setSueldos]    = useState({})
  const [config,      setConfig]     = useState(CONFIG_DEFAULT)
  const [clientes,    setClientes]   = useState([])
  const saveTimer     = useRef(null)
  const initialized   = useRef(false)
  // Track when we last loaded from Supabase — don't save if we haven't made a user change
  const userChanged   = useRef(false)
  const loadedAt      = useRef(null)

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!hasLoaded.current) {
        console.warn("Supabase tardó demasiado — cargando con datos vacíos")
        setLoaded(true)
        hasLoaded.current = true
        initialized.current = true
        loadedAt.current = new Date().toISOString()
      }
    }, 7000)

    loadAll().then(({ ad, gs, ss, cf, cl }) => {
      if (ad?.data && typeof ad.data === "object" && !Array.isArray(ad.data)) setAllData(ad.data)
      if (gs?.data && Array.isArray(gs.data)) setGastos(gs.data)
      if (ss?.data && typeof ss.data === "object" && !Array.isArray(ss.data)) setSueldos(ss.data)
      if (cf?.data && typeof cf.data === "object" && !Array.isArray(cf.data)) setConfig(prev => ({ ...prev, ...cf.data }))
      if (cl?.data && Array.isArray(cl.data)) setClientes(cl.data)
      loadedAt.current = new Date().toISOString()
      setLoaded(true)
      hasLoaded.current = true
      // Wait a tick before allowing saves so initial setState doesn't trigger save
      setTimeout(() => { initialized.current = true }, 500)
    }).catch(e => {
      console.error("Error cargando datos:", e)
      setLoaded(true)
      hasLoaded.current = true
      loadedAt.current = new Date().toISOString()
      setTimeout(() => { initialized.current = true }, 500)
    }).finally(() => clearTimeout(fallback))
  }, [])

  // ── Auto-save — only when user makes changes ──────────────────────────────
  useEffect(() => {
    if (!initialized.current) return
    if (!userChanged.current) {
      // First trigger after load — mark as ready but don't save yet
      userChanged.current = true
      return
    }
    setSaveStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
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
        // Retry in 5s
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
