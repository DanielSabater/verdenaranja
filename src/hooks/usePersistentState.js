import { useState, useEffect, useRef } from "react"
import { CONFIG_DEFAULT } from "../constants/data.js"

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const TABLE         = "perlaverde_data"

// ── localStorage helpers ──────────────────────────────────────────────────────
const LS_KEYS = {
  allData:  "pv:allData",
  gastos:   "pv:gastos",
  sueldos:  "pv:sueldos",
  config:   "pv:config",
  clientes: "pv:clientes",
}

function lsRead(key) {
  try {
    const v = localStorage.getItem(LS_KEYS[key])
    return v ? JSON.parse(v) : null
  } catch { return null }
}

function lsWrite(key, data) {
  try { localStorage.setItem(LS_KEYS[key], JSON.stringify(data)) } catch {}
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
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
  } catch { return null } finally { clearTimeout(timeout) }
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
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    } catch { await new Promise(r => setTimeout(r, 800 * (i + 1))) }
  }
  throw new Error(`No se pudo guardar ${id}`)
}

async function loadAll() {
  const [ad, gs, ss, cf, cl] = await Promise.all([
    dbRead("allData"), dbRead("gastos"), dbRead("sueldos"),
    dbRead("config"),  dbRead("clientes"),
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
  const userChanged  = useRef(false)

  // ── Load on mount: Supabase primero, localStorage como fallback ────────────
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!hasLoaded.current) {
        console.warn("Supabase no respondió — usando datos locales")
        // Load from localStorage
        const ad = lsRead("allData"); const gs = lsRead("gastos")
        const ss = lsRead("sueldos"); const cf = lsRead("config")
        const cl = lsRead("clientes")
        if (ad) setAllData(ad)
        if (gs) setGastos(gs)
        if (ss) setSueldos(ss)
        if (cf) setConfig(prev => ({ ...prev, ...cf }))
        if (cl) setClientes(cl)
        setLoaded(true)
        hasLoaded.current = true
        setTimeout(() => { initialized.current = true }, 500)
      }
    }, 6000)

    loadAll().then(({ ad, gs, ss, cf, cl }) => {
      // Use Supabase data if available, otherwise fall back to localStorage
      const finalAd = (ad && typeof ad === "object" && !Array.isArray(ad)) ? ad : lsRead("allData") || {}
      const finalGs = Array.isArray(gs) ? gs : lsRead("gastos") || []
      const finalSs = (ss && typeof ss === "object" && !Array.isArray(ss)) ? ss : lsRead("sueldos") || {}
      const finalCf = (cf && typeof cf === "object" && !Array.isArray(cf)) ? cf : lsRead("config") || {}
      const finalCl = Array.isArray(cl) ? cl : lsRead("clientes") || []

      setAllData(finalAd)
      setGastos(finalGs)
      setSueldos(finalSs)
      setConfig(prev => ({ ...prev, ...finalCf }))
      setClientes(finalCl)

      // Also update localStorage with latest Supabase data
      if (ad) lsWrite("allData", finalAd)
      if (gs) lsWrite("gastos",  finalGs)
      if (ss) lsWrite("sueldos", finalSs)
      if (cf) lsWrite("config",  finalCf)
      if (cl) lsWrite("clientes",finalCl)

      setLoaded(true)
      hasLoaded.current = true
      setTimeout(() => { initialized.current = true }, 500)
    }).catch(e => {
      console.error("Error cargando de Supabase:", e)
      // Full fallback to localStorage
      const ad = lsRead("allData"); const gs = lsRead("gastos")
      const ss = lsRead("sueldos"); const cf = lsRead("config")
      const cl = lsRead("clientes")
      if (ad) setAllData(ad)
      if (gs) setGastos(gs)
      if (ss) setSueldos(ss)
      if (cf) setConfig(prev => ({ ...prev, ...cf }))
      if (cl) setClientes(cl)
      setLoaded(true)
      hasLoaded.current = true
      setTimeout(() => { initialized.current = true }, 500)
    }).finally(() => clearTimeout(fallback))
  }, [])

  // ── Auto-save: Supabase + localStorage ───────────────────────────────────
  useEffect(() => {
    if (!initialized.current) return
    if (!userChanged.current) { userChanged.current = true; return }

    setSaveStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      // Always save to localStorage immediately
      lsWrite("allData",  allData)
      lsWrite("gastos",   gastos)
      lsWrite("sueldos",  sueldos)
      lsWrite("config",   config)
      lsWrite("clientes", clientes)

      // Then try Supabase with retries
      try {
        await dbWrite("allData",  allData)
        await dbWrite("gastos",   gastos)
        await dbWrite("sueldos",  sueldos)
        await dbWrite("config",   config)
        await dbWrite("clientes", clientes)
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 2200)
      } catch(e) {
        console.error("Error en Supabase, datos guardados localmente:", e)
        setSaveStatus("error")
        // Retry Supabase in 5s (localStorage ya está actualizado)
        saveTimer.current = setTimeout(async () => {
          try {
            await dbWrite("allData",  allData)
            await dbWrite("gastos",   gastos)
            await dbWrite("sueldos",  sueldos)
            await dbWrite("config",   config)
            await dbWrite("clientes", clientes)
            setSaveStatus("saved")
            setTimeout(() => setSaveStatus("idle"), 2200)
          } catch { setSaveStatus("error") }
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
