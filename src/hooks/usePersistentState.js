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
}

function lsRead(key) {
  try {
    const v = localStorage.getItem(`pv:${key}`)
    return v ? JSON.parse(v) : null
  } catch { return null }
}

function lsWrite(key, data) {
  try { localStorage.setItem(`pv:${key}`, JSON.stringify(data)) } catch {}
}

export function usePersistentState(currentDate) {
  const [loaded,     setLoaded]     = useState(false)
  const [saveStatus, setSaveStatus] = useState("idle")
  const [connStatus, setConnStatus] = useState("connecting") // online, offline, connecting
  
  const [allData,    setAllData]    = useState({})
  const [config,     setConfig]     = useState(() => lsRead("config") || CONFIG_DEFAULT)
  const [clientes,   setClientes]   = useState(() => lsRead("clientes") || [])
  const [gastos,     setGastos]     = useState(() => lsRead("gastos") || [])
  const [sueldos,    setSueldos]    = useState(() => lsRead("sueldos") || {})

  const [remoteEdits, setRemoteEdits] = useState({}) 
  const sessionId   = useRef(Math.random().toString(36).substring(7))
  const channelRef  = useRef(null)
  
  const lastSaved   = useRef({})
  const isInitial   = useRef(true)
  const dirtyKeys   = useRef(new Set())

  // ── 1. Initial Load & Realtime Subscription ────────────────────────────────
  useEffect(() => {
    const loadStatic = async () => {
      try {
        const { data, error } = await supabase.from(TABLE).select("id, data")
        if (error || !data) {
          console.error("Failed to load initial data from Supabase, retrying in 5s...", error)
          setTimeout(loadStatic, 5000)
          return
        }
        
        const updates = {}
        const legacy = data.find(r => r.id === "allData")?.data || {}
        
        data.forEach(row => {
          const str = JSON.stringify(row.data)
          lastSaved.current[row.id] = str
          
          if (row.id === "config")   setConfig(row.data)
          if (row.id === "clientes") setClientes(row.data)
          if (row.id === "gastos")   setGastos(row.data)
          if (row.id === "sueldos")  setSueldos(row.data)
          if (row.id.startsWith("day:")) {
            const dateKey = row.id.replace("day:", "")
            updates[dateKey] = row.data
          }
        })

        setAllData(prev => ({ ...legacy, ...updates, ...prev }))
        setLoaded(true)
        setTimeout(() => { isInitial.current = false }, 1000)
      } catch (err) {
        console.error("Unexpected error in loadStatic, retrying in 5s...", err)
        setTimeout(loadStatic, 5000)
      }
    }

    loadStatic()

    const channel = supabase.channel("perlaverde_realtime", {
      config: { broadcast: { ack: true } }
    })
    
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, payload => {
        const row = payload.new || payload.old
        if (!row) return
        const str = JSON.stringify(row.data)
        if (lastSaved.current[row.id] !== str) {
          lastSaved.current[row.id] = str
          if (row.id === "config")   setConfig(row.data)
          if (row.id === "clientes") setClientes(row.data)
          if (row.id === "gastos")   setGastos(row.data)
          if (row.id === "sueldos")  setSueldos(row.data)
          if (row.id.startsWith("day:")) {
            const dateKey = row.id.replace("day:", "")
            setAllData(prev => ({ ...prev, [dateKey]: row.data }))
          }
        }
      })
      .on("broadcast", { event: "editing" }, ({ payload }) => {
        if (payload.sessionId === sessionId.current) return
        setRemoteEdits(prev => {
          const next = { ...prev }
          if (payload.isEditing) {
            next[payload.cellKey] = { timestamp: Date.now(), sessionId: payload.sessionId }
          } else {
            delete next[payload.cellKey]
          }
          return next
        })
      })
      .subscribe((status) => {
        setConnStatus(status === "SUBSCRIBED" ? "online" : "offline")
      })

    channelRef.current = channel

    const cleanup = setInterval(() => {
      setRemoteEdits(prev => {
        const now = Date.now()
        const next = { ...prev }
        let changed = false
        Object.entries(next).forEach(([k, v]) => {
          if (now - v.timestamp > 15000) { delete next[k]; changed = true }
        })
        return changed ? next : prev
      })
    }, 10000)

    const handleReconnect = () => {
      if (supabase && supabase.realtime && supabase.realtime.connection.state !== "connected") {
        supabase.realtime.connect()
      }
    }
    window.addEventListener("focus", handleReconnect)
    document.addEventListener("visibilitychange", handleReconnect)

    return () => { 
      supabase.removeChannel(channel)
      clearInterval(cleanup)
      window.removeEventListener("focus", handleReconnect)
      document.removeEventListener("visibilitychange", handleReconnect)
    }
  }, [])

  // ── 2. Load Specific Day ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentDate || !loaded) return
    const loadDay = async () => {
      const id = `day:${currentDate}`
      const { data } = await supabase.from(TABLE).select("data").eq("id", id).maybeSingle()
      if (data) {
        lastSaved.current[id] = JSON.stringify(data.data)
        setAllData(prev => ({ ...prev, [currentDate]: data.data }))
      }
    }
    if (!allData[currentDate]) loadDay()
  }, [currentDate, loaded])

  // ── 3. Auto-Save Engine ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isInitial.current || !loaded) return
    const saveTimer = setTimeout(async () => {
      const tasks = []
      const check = (id, currentVal) => {
        // 1. Solo procesamos si el campo fue marcado como modificado por el usuario
        if (!dirtyKeys.current.has(id)) return

        const str = JSON.stringify(currentVal)
        
        // Si el estado local coincide con lo guardado, lo sacamos de la lista sucia
        if (lastSaved.current[id] === str) {
          dirtyKeys.current.delete(id)
          return
        }

        const lastValStr = lastSaved.current[id]

        // 2. Filtro Antivaciado (Salvaguarda de Sobreescritura)
        if (lastValStr) {
          try {
            const lastVal = JSON.parse(lastValStr)

            // Configuración
            if (id === "config") {
              const oldProfs = lastVal.professionals || []
              const newProfs = currentVal.professionals || []
              if (oldProfs.length > 0 && newProfs.length === 0) {
                console.error("[Filtro Antivaciado] Sincronización de configuración bloqueada: profesionales vacíos.")
                alert("Error de seguridad: Se detectó un intento de vaciar la configuración de profesionales. Para proteger tus datos, el guardado automático fue bloqueado. Por favor, recarga la página.")
                return
              }
            }

            // Clientes
            if (id === "clientes") {
              if (lastVal.length > 0 && (currentVal || []).length === 0) {
                console.error("[Filtro Antivaciado] Sincronización de clientes bloqueada: clientes vacíos.")
                alert("Error de seguridad: Se detectó un intento de vaciar la lista de clientes. El guardado automático fue bloqueado. Por favor, recarga la página.")
                return
              }
            }

            // Turnos diarios
            if (id.startsWith("day:")) {
              const oldApptsCount = Object.keys(lastVal || {}).length
              const newApptsCount = Object.keys(currentVal || {}).length

              if (oldApptsCount > 2 && newApptsCount === 0) {
                const confirmed = window.confirm(
                  `Atención: Se detectó que se eliminarán todos los turnos (${oldApptsCount}) agendados para este día. ¿Confirmas esta acción? (Si esto es un error de conexión, cancelá y recargá la página)`
                )
                if (!confirmed) {
                  // Restauramos la referencia de guardado para evitar bucles
                  lastSaved.current[id] = lastValStr
                  return
                }
              }
            }
          } catch (e) {
            console.error("Safeguard validation error:", e)
          }
        }

        if (lastSaved.current[id] !== str) {
          lastSaved.current[id] = str
          lsWrite(id.replace("day:", ""), currentVal)
          tasks.push({ id, data: currentVal, updated_at: new Date().toISOString() })
        }
      }

      check("config", config)
      check("clientes", clientes)
      check("gastos", gastos)
      check("sueldos", sueldos)
      Object.keys(allData).forEach(date => check(`day:${date}`, allData[date]))

      if (tasks.length > 0) {
        setSaveStatus("saving")
        const { error } = await supabase.from(TABLE).upsert(tasks)
        if (error) {
          setSaveStatus("error")
        } else {
          // Limpiamos del set de dirtyKeys los IDs que se guardaron correctamente
          tasks.forEach(t => dirtyKeys.current.delete(t.id))
          setSaveStatus("saved")
          setTimeout(() => setSaveStatus("idle"), 1500)
        }
      }
    }, 1000)
    return () => clearTimeout(saveTimer)
  }, [allData, config, clientes, gastos, sueldos, loaded])

  // ── 4. Exposed Setters ─────────────────────────────────────────────────────
  const setAppointments = (updater) => {
    dirtyKeys.current.add(`day:${currentDate}`)
    setAllData(prev => {
      const current = prev[currentDate] || {}
      const next = typeof updater === "function" ? updater(current) : updater
      return { ...prev, [currentDate]: next }
    })
  }

  // Setters envolventes para componentes (registran el cambio del usuario en dirtyKeys)
  const setConfigUser = (updater) => {
    dirtyKeys.current.add("config")
    setConfig(updater)
  }

  const setClientesUser = (updater) => {
    dirtyKeys.current.add("clientes")
    setClientes(updater)
  }

  const setGastosUser = (updater) => {
    dirtyKeys.current.add("gastos")
    setGastos(updater)
  }

  const setSueldosUser = (updater) => {
    dirtyKeys.current.add("sueldos")
    setSueldos(updater)
  }

  const broadcastEditing = (cellKey, isEditing) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "editing",
        payload: { cellKey, isEditing, sessionId: sessionId.current }
      })
    }
  }

  return {
    loaded, saveStatus, connStatus,
    allData,   setAppointments,
    config,    setConfig: setConfigUser,
    clientes,  setClientes: setClientesUser,
    gastos,    setGastos: setGastosUser,
    sueldos,   setSueldos: setSueldosUser,
    remoteEdits, broadcastEditing
  }
}
