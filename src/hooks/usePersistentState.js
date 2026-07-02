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
  const [allArqueos, setAllArqueos] = useState(() => {
    const initial = {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("vn_arqueo_")) {
          const date = key.replace("vn_arqueo_", "")
          const val = localStorage.getItem(key)
          if (val) {
            initial[date] = JSON.parse(val)
          }
        }
      }
    } catch (e) {
      console.warn("Failed to pre-populate arqueos from localStorage:", e)
    }
    return initial
  })
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
  const lastFetchTime = useRef(0)
  const fetchedDates = useRef(new Set())

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
        const arqueoUpdates = {}
        const legacy = data.find(r => r.id === "allData")?.data || {}
        
        data.forEach(row => {
          const str = JSON.stringify(row.data)
          lastSaved.current[row.id] = str
          
          // Solo actualizamos el estado si no tiene modificaciones locales sin guardar
          if (!dirtyKeys.current.has(row.id)) {
            if (row.id === "config")   setConfig(row.data)
            if (row.id === "clientes") setClientes(row.data)
            if (row.id === "gastos")   setGastos(row.data)
            if (row.id === "sueldos")  setSueldos(row.data)
          }
          if (row.id.startsWith("day:")) {
            const dateKey = row.id.replace("day:", "")
            updates[dateKey] = row.data
            fetchedDates.current.add(dateKey)
          }
          if (row.id.startsWith("arqueo:")) {
            const dateKey = row.id.replace("arqueo:", "")
            arqueoUpdates[dateKey] = row.data
            fetchedDates.current.add(dateKey)
          }
        })

        // Detect local-only arqueos to sync
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith("vn_arqueo_")) {
              const dateKey = key.replace("vn_arqueo_", "")
              const id = `arqueo:${dateKey}`
              if (!arqueoUpdates[dateKey]) {
                console.log(`[usePersistentState] Arqueo local detectado para ${dateKey} no existente en Supabase, marcando para subir.`)
                dirtyKeys.current.add(id)
              }
            }
          }
        } catch (e) {
          console.warn("Error detecting local-only arqueos:", e)
        }

        setAllData(prev => {
          // Fusionamos prev y updates respetando dirtyKeys
          const next = { ...legacy, ...prev }
          Object.keys(updates).forEach(dateKey => {
            const id = `day:${dateKey}`
            if (!dirtyKeys.current.has(id)) {
              next[dateKey] = updates[dateKey]
            }
          })
          return next
        })

        setAllArqueos(prev => {
          const next = { ...prev }
          Object.keys(arqueoUpdates).forEach(dateKey => {
            const id = `arqueo:${dateKey}`
            if (!dirtyKeys.current.has(id)) {
              next[dateKey] = arqueoUpdates[dateKey]
            }
          })
          return next
        })
        
        lastFetchTime.current = Date.now()
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
          if (row.id.startsWith("arqueo:")) {
            const dateKey = row.id.replace("arqueo:", "")
            setAllArqueos(prev => ({ ...prev, [dateKey]: row.data }))
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
      try {
        const state = supabase?.realtime?.connection?.state
        if (state && state !== "connected") {
          supabase.realtime.connect()
        } else if (supabase?.realtime && typeof supabase.realtime.connect === "function") {
          supabase.realtime.connect()
        }
      } catch (err) {
        console.warn("No se pudo verificar el estado de realtime:", err)
      }
      const now = Date.now()
      if (now - lastFetchTime.current > 30000) {
        lastFetchTime.current = now
        loadStatic()
      }
    }
    window.addEventListener("focus", handleReconnect)
    document.addEventListener("visibilitychange", handleReconnect)
    window.addEventListener("online", handleReconnect)

    // Detector de suspensión de la CPU (Salto de tiempo)
    let lastTime = Date.now()
    const checkSleep = setInterval(() => {
      const currentTime = Date.now()
      // Si el reloj interno salta más de 10 segundos, significa que la CPU estuvo suspendida
      if (currentTime - lastTime > 10000) {
        console.log("[usePersistentState] Waking up from suspension, triggering refetch...")
        handleReconnect()
      }
      lastTime = currentTime
    }, 2000)

    return () => { 
      supabase.removeChannel(channel)
      clearInterval(cleanup)
      clearInterval(checkSleep)
      window.removeEventListener("focus", handleReconnect)
      document.removeEventListener("visibilitychange", handleReconnect)
      window.removeEventListener("online", handleReconnect)
    }
  }, [])

  // ── 2. Load Specific Day ────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentDate || !loaded) return
    if (fetchedDates.current.has(currentDate)) return

    const loadDayAndArqueo = async () => {
      const dateToFetch = currentDate
      fetchedDates.current.add(dateToFetch)

      const id = `day:${dateToFetch}`
      const arqueoId = `arqueo:${dateToFetch}`

      try {
        const [dayRes, arqueoRes] = await Promise.all([
          supabase.from(TABLE).select("data").eq("id", id).maybeSingle(),
          supabase.from(TABLE).select("data").eq("id", arqueoId).maybeSingle()
        ])

        if (dayRes.data) {
          lastSaved.current[id] = JSON.stringify(dayRes.data.data)
          setAllData(prev => ({ ...prev, [dateToFetch]: dayRes.data.data }))
        }
        if (arqueoRes.data) {
          lastSaved.current[arqueoId] = JSON.stringify(arqueoRes.data.data)
          setAllArqueos(prev => ({ ...prev, [dateToFetch]: arqueoRes.data.data }))
        }
      } catch (err) {
        console.error(`Failed to load data for date ${dateToFetch}:`, err)
        fetchedDates.current.delete(dateToFetch)
      }
    }

    loadDayAndArqueo()
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
          if (id.startsWith("arqueo:")) {
            const date = id.replace("arqueo:", "")
            try { localStorage.setItem(`vn_arqueo_${date}`, str) } catch {}
          } else {
            lsWrite(id.replace("day:", ""), currentVal)
          }
          tasks.push({ id, data: currentVal, updated_at: new Date().toISOString() })
        }
      }

      check("config", config)
      check("clientes", clientes)
      check("gastos", gastos)
      check("sueldos", sueldos)
      Object.keys(allData).forEach(date => check(`day:${date}`, allData[date]))
      Object.keys(allArqueos).forEach(date => check(`arqueo:${date}`, allArqueos[date]))

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
  }, [allData, allArqueos, config, clientes, gastos, sueldos, loaded])

  // ── 4. Exposed Setters ─────────────────────────────────────────────────────
  const setAppointments = (updater) => {
    dirtyKeys.current.add(`day:${currentDate}`)
    setAllData(prev => {
      const current = prev[currentDate] || {}
      const next = typeof updater === "function" ? updater(current) : updater
      return { ...prev, [currentDate]: next }
    })
  }

  const setArqueo = (updater) => {
    dirtyKeys.current.add(`arqueo:${currentDate}`)
    setAllArqueos(prev => {
      const current = prev[currentDate] || { 100: 0, 200: 0, 500: 0, 1000: 0, 2000: 0, 10000: 0, 20000: 0 }
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
    allArqueos, setArqueo,
    config,    setConfig: setConfigUser,
    clientes,  setClientes: setClientesUser,
    gastos,    setGastos: setGastosUser,
    sueldos,   setSueldos: setSueldosUser,
    remoteEdits, broadcastEditing
  }
}
