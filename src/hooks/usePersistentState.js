import { useState, useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"
import { CONFIG_DEFAULT } from "../constants/data.js"

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const TABLE         = "perlaverde_data"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── localStorage helpers ──────────────────────────────────────────────────────
const LS_KEYS = {
  config:   "pv:config",
  clientes: "pv:clientes",
  gastos:   "pv:gastos",
  sueldos:  "pv:sueldos",
  allData:  "pv:allData", // Legacy
}

function lsRead(key) {
  try {
    const v = localStorage.getItem(LS_KEYS[key] || `pv:day:${key}`)
    return v ? JSON.parse(v) : null
  } catch { return null }
}

function lsWrite(key, data) {
  try { localStorage.setItem(LS_KEYS[key] || `pv:day:${key}`, JSON.stringify(data)) } catch {}
}

export function usePersistentState(currentDate) {
  const [loaded,     setLoaded]     = useState(false)
  const [saveStatus, setSaveStatus] = useState("idle")
  
  const [allData,    setAllData]    = useState({})
  const [config,     setConfig]     = useState(() => lsRead("config") || CONFIG_DEFAULT)
  const [clientes,   setClientes]   = useState(() => lsRead("clientes") || [])
  const [gastos,     setGastos]     = useState(() => lsRead("gastos") || [])
  const [sueldos,    setSueldos]    = useState(() => lsRead("sueldos") || {})

  const initialized = useRef(false)
  const lastSync    = useRef({}) // To avoid feedback loops

  // ── 1. Initial Load & Realtime Subscription ────────────────────────────────
  useEffect(() => {
    // Load static collections once
    const loadStatic = async () => {
      const { data } = await supabase.from(TABLE).select("id, data")
      if (!data) return
      
      const updates = {}
      data.forEach(row => {
        if (row.id === "config")   setConfig(row.data)
        if (row.id === "clientes") setClientes(row.data)
        if (row.id === "gastos")   setGastos(row.data)
        if (row.id === "sueldos")  setSueldos(row.data)
        if (row.id === "allData")  updates.legacy = row.data
      })

      // Migration: if we have legacy data, we keep it in memory
      if (updates.legacy) {
        setAllData(prev => ({ ...updates.legacy, ...prev }))
      }
      
      setLoaded(true)
      initialized.current = true
    }

    loadStatic()

    // Subscribe to REALTIME changes
    const channel = supabase
      .channel("any")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLE }, payload => handleRemote(payload.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: TABLE }, payload => handleRemote(payload.new))
      .subscribe()

    function handleRemote(row) {
      // Don't update if WE just sent this change
      if (lastSync.current[row.id] === JSON.stringify(row.data)) return

      if (row.id === "config")   setConfig(row.data)
      if (row.id === "clientes") setClientes(row.data)
      if (row.id === "gastos")   setGastos(row.data)
      if (row.id === "sueldos")  setSueldos(row.data)
      if (row.id.startsWith("day:")) {
        const dateKey = row.id.replace("day:", "")
        setAllData(prev => ({ ...prev, [dateKey]: row.data }))
      }
    }

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── 2. Load Specific Day when Date changes ──────────────────────────────────
  useEffect(() => {
    if (!currentDate) return
    
    const loadDay = async () => {
      const { data, error } = await supabase.from(TABLE).select("data").eq("id", `day:${currentDate}`).single()
      if (data) {
        setAllData(prev => ({ ...prev, [currentDate]: data.data }))
        lsWrite(currentDate, data.data)
      } else {
        // Fallback to localStorage if offline or not found
        const local = lsRead(currentDate)
        if (local) setAllData(prev => ({ ...prev, [currentDate]: local }))
      }
    }

    if (!allData[currentDate]) loadDay()
  }, [currentDate])

  // ── 3. Optimized Save Helpers ───────────────────────────────────────────────
  const saveToCloud = async (id, data) => {
    const dataStr = JSON.stringify(data)
    if (lastSync.current[id] === dataStr) return
    
    setSaveStatus("saving")
    lastSync.current[id] = dataStr
    lsWrite(id.replace("day:", ""), data)

    const { error } = await supabase.from(TABLE).upsert({ 
      id, 
      data, 
      updated_at: new Date().toISOString() 
    })

    if (error) {
      setSaveStatus("error")
      console.error(`Error saving ${id}:`, error)
    } else {
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    }
  }

  // ── 4. Exposed Setters with auto-save ───────────────────────────────────────
  const wrapSet = (id, setter) => (val) => {
    setter(prev => {
      const next = typeof val === "function" ? val(prev) : val
      saveToCloud(id, next)
      return next
    })
  }

  const setAppointments = (updater) => {
    setAllData(prev => {
      const currentDay = prev[currentDate] || {}
      const nextDay = typeof updater === "function" ? updater(currentDay) : updater
      saveToCloud(`day:${currentDate}`, nextDay)
      return { ...prev, [currentDate]: nextDay }
    })
  }

  return {
    loaded, saveStatus,
    allData,   setAppointments,
    config,    setConfig:   wrapSet("config",   setConfig),
    clientes,  setClientes: wrapSet("clientes", setClientes),
    gastos,    setGastos:   wrapSet("gastos",   setGastos),
    sueldos,   setSueldos:  wrapSet("sueldos",  setSueldos),
  }
}
