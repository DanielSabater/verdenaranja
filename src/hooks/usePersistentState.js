import { useState, useEffect, useRef } from "react"
import { CONFIG_DEFAULT } from "../constants/data.js"

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_ANON_KEY
const TABLE            = "perlaverde_data"

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function dbRead(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=data`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
  )
  const rows = await res.json()
  return rows?.[0]?.data ?? null
}

async function dbWrite(id, data) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}`,
    {
      method:  "POST",
      headers: {
        apikey:          SUPABASE_ANON,
        Authorization:   `Bearer ${SUPABASE_ANON}`,
        "Content-Type":  "application/json",
        Prefer:          "resolution=merge-duplicates",
      },
      body: JSON.stringify({ id, data, updated_at: new Date().toISOString() }),
    }
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePersistentState() {
  const [loaded,     setLoaded]     = useState(false)
  const [saveStatus, setSaveStatus] = useState("idle")
  const [allData,    setAllData]    = useState({})
  const [gastos,     setGastos]     = useState([])
  const [sueldos,    setSueldos]    = useState({})
  const [config,     setConfig]     = useState(CONFIG_DEFAULT)
  const [clientes,   setClientes]   = useState([])
  const saveTimer = useRef(null)
  const initialized = useRef(false)

  // ── Load from Supabase on mount ──────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [ad, gs, ss, cf, cl] = await Promise.all([
          dbRead("allData"),
          dbRead("gastos"),
          dbRead("sueldos"),
          dbRead("config"),
          dbRead("clientes"),
        ])
        if (ad) setAllData(ad)
        if (gs) setGastos(gs)
        if (ss) setSueldos(ss)
        if (cf) setConfig(prev => ({ ...prev, ...cf }))
        if (cl) setClientes(cl)
      } catch (e) {
        console.error("Error cargando datos:", e)
      } finally {
        setLoaded(true)
        initialized.current = true
      }
    }
    load()
  }, [])

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
  }
}
