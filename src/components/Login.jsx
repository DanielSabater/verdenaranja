import { useState } from "react"
import { C } from "../constants/colors.js"

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  return res.json()
}

async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  return res.json()
}

export default function Login({ onLogin }) {
  const [mode,     setMode]     = useState("login") // "login" | "register"
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState("")

  const inp = {
    width: "100%", padding: "11px 14px",
    border: `1.5px solid ${C.border}`, borderRadius: 10,
    fontSize: 14, color: C.text, background: C.cream,
    outline: "none", fontFamily: "Georgia,serif",
    boxSizing: "border-box",
  }

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError("Completá todos los campos"); return }
    setLoading(true); setError(""); setSuccess("")
    try {
      if (mode === "login") {
        const data = await signIn(email, password)
        if (data.error) { setError("Email o contraseña incorrectos"); return }
        onLogin(data.access_token, data.user)
      } else {
        const data = await signUp(email, password)
        if (data.error) { setError(data.error.message || "Error al registrarse"); return }
        setSuccess("¡Cuenta creada! Revisá tu email para confirmar.")
        setMode("login")
      }
    } catch (e) {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif" }}>
      <div style={{ width:"min(420px,calc(100vw - 32px))", padding:32, background:C.white, borderRadius:20, boxShadow:`0 20px 60px rgba(58,125,68,.12)`, border:`1px solid ${C.border}` }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:`linear-gradient(135deg,${C.green},${C.greenLight})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 12px" }}>🌿</div>
          <div style={{ fontSize:8, letterSpacing:"3px", color:C.orange, textTransform:"uppercase" }}>Turnos · Spa</div>
          <div style={{ fontSize:22, color:C.green }}>Perla Verde</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:24 }}>
          {[["login","Ingresar"],["register","Crear cuenta"]].map(([id,label]) => (
            <button key={id} onClick={()=>{setMode(id);setError("");setSuccess("")}} style={{ flex:1, padding:"9px 0", borderRadius:20, border:`1.5px solid ${mode===id?C.green:C.border}`, background:mode===id?`linear-gradient(135deg,${C.green},${C.greenLight})`:C.white, color:mode===id?"#fff":C.textSoft, fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif", transition:"all .18s" }}>{label}</button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Email</div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" type="email" style={inp} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:8, letterSpacing:"2px", color:C.textSoft, textTransform:"uppercase", marginBottom:6 }}>Contraseña</div>
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" type="password" style={inp} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
        </div>

        {error   && <div style={{ fontSize:12, color:"#c04040", background:"#fde8e8", padding:"8px 12px", borderRadius:8, marginBottom:14 }}>⚠️ {error}</div>}
        {success && <div style={{ fontSize:12, color:C.green, background:C.greenPale, padding:"8px 12px", borderRadius:8, marginBottom:14 }}>✅ {success}</div>}

        <button onClick={handleSubmit} disabled={loading} style={{ width:"100%", padding:"13px 0", borderRadius:12, border:"none", background:loading?"#e8e8e8":`linear-gradient(135deg,${C.green},${C.greenLight})`, color:loading?"#bbb":"#fff", fontSize:13, cursor:loading?"not-allowed":"pointer", fontFamily:"Georgia,serif", letterSpacing:"1px" }}>
          {loading ? "..." : mode==="login" ? "Ingresar" : "Crear cuenta"}
        </button>
      </div>
    </div>
  )
}
