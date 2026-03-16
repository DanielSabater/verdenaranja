import { useState, useEffect, useRef } from "react"
import { dbGet, dbSet } from "../utils/storage.js"
import { DB_KEYS, CONFIG_DEFAULT } from "../constants/data.js"

/**
 * Loads allData, gastos, sueldos, config from localStorage on mount.
 * Auto-saves (debounced 600ms) whenever any of them change.
 * Returns { loaded, saveStatus, allData, setAllData, gastos, setGastos, sueldos, setSueldos, config, setConfig }
 */
export function usePersistentState() {
  const [loaded,    setLoaded]    = useState(false)
  const [saveStatus, setSaveStatus] = useState("idle")
  const [allData,   setAllData]   = useState({})
  const [gastos,    setGastos]    = useState([])
  const [sueldos,   setSueldos]   = useState({})
  const [config,    setConfig]    = useState(CONFIG_DEFAULT)
  const [clientes,  setClientes]  = useState([])
  const saveTimer = useRef(null)

  // Load on mount
  useEffect(() => {
    const ad = dbGet(DB_KEYS.allData)
    const gs = dbGet(DB_KEYS.gastos)
    const ss = dbGet(DB_KEYS.sueldos)
    const cf = dbGet(DB_KEYS.config)
    const cl = dbGet(DB_KEYS.clientes)
    if (ad) setAllData(ad)
    if (gs) setGastos(gs)
    if (ss) setSueldos(ss)
    if (cf) setConfig(prev => ({ ...prev, ...cf }))
    if (cl) setClientes(cl)
    setLoaded(true)
  }, [])

  // Auto-save debounced
  useEffect(() => {
    if (!loaded) return
    setSaveStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const ok = [
        dbSet(DB_KEYS.allData,  allData),
        dbSet(DB_KEYS.gastos,   gastos),
        dbSet(DB_KEYS.sueldos,  sueldos),
        dbSet(DB_KEYS.config,   config),
        dbSet(DB_KEYS.clientes, clientes),
      ].every(Boolean)
      setSaveStatus(ok ? "saved" : "error")
      if (ok) setTimeout(() => setSaveStatus("idle"), 2200)
    }, 600)
    return () => clearTimeout(saveTimer.current)
  }, [allData, gastos, sueldos, config, clientes, loaded])

  return {
    loaded, saveStatus,
    allData, setAllData,
    gastos,  setGastos,
    sueldos, setSueldos,
    config,  setConfig,
    clientes, setClientes,
  }
}
