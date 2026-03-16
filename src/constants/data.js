import { C } from './colors.js'

export const PROFESSIONALS_DEFAULT = [
  { id: 1, name: "Valentina", emoji: "🌿" },
  { id: 2, name: "Sofía",     emoji: "🌸" },
  { id: 3, name: "Camila",    emoji: "✨" },
  { id: 4, name: "Isabella",  emoji: "🍃" },
  { id: 5, name: "Luciana",   emoji: "🌺" },
]

export const SERVICES_DEFAULT = [
  { id: 1, name: "Manicura clásica",        duration: 45,  price: 3500,  category: "manos", icon: "💅" },
  { id: 2, name: "Manicura semipermanente", duration: 60,  price: 5500,  category: "manos", icon: "💎" },
  { id: 3, name: "Nail art",                duration: 90,  price: 7500,  category: "manos", icon: "🎨" },
  { id: 4, name: "Pedicura clásica",        duration: 60,  price: 4500,  category: "pies",  icon: "🦶" },
  { id: 5, name: "Pedicura semipermanente", duration: 75,  price: 6500,  category: "pies",  icon: "✨" },
  { id: 6, name: "Spa de pies",             duration: 90,  price: 8500,  category: "pies",  icon: "🌺" },
  { id: 7, name: "Manos + Pies clásico",    duration: 90,  price: 7000,  category: "combo", icon: "🌸" },
  { id: 8, name: "Manos + Pies semi",       duration: 120, price: 10500, category: "combo", icon: "👑" },
]

export const PAYMENT_METHODS = [
  { id: "efectivo",    label: "Efectivo",     icon: "💵", color: C.green },
  { id: "debito",      label: "Débito",       icon: "💳", color: C.amber },
  { id: "mercadopago", label: "Mercado Pago", icon: "📲", color: C.mp   },
]

export const GASTO_CATS = [
  { id: "insumos",   label: "Insumos",   icon: "🧴" },
  { id: "servicios", label: "Servicios", icon: "💡" },
  { id: "alquiler",  label: "Alquiler",  icon: "🏠" },
  { id: "sueldos",   label: "Sueldos",   icon: "👩" },
  { id: "marketing", label: "Marketing", icon: "📣" },
  { id: "otros",     label: "Otros",     icon: "📦" },
]

export const CAT_OPTIONS = [
  { id: "manos", label: "Manos", icon: "💅" },
  { id: "pies",  label: "Pies",  icon: "🦶" },
  { id: "combo", label: "Combo", icon: "🌸" },
  { id: "otro",  label: "Otro",  icon: "✨" },
]

export const EMOJI_SUGGESTIONS = [
  "🌿","🌸","✨","🍃","🌺","💅","💎","👑","🌻","🦋",
  "🌷","🍀","🌼","🌙","⭐","🎀","💖","🌈","🦚","🌊",
]

// Generate hours 09:00 → 19:30 in 30-min slots
export const HOURS = []
for (let m = 9 * 60; m < 20 * 60; m += 30)
  HOURS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`)

export const DB_KEYS = {
  allData:  "perlaverde:allData",
  gastos:   "perlaverde:gastos",
  sueldos:  "perlaverde:sueldos",
  config:   "perlaverde:config",
  clientes: "perlaverde:clientes",
}

export const CONFIG_DEFAULT = {
  empresaNombre:    "Perla Verde",
  empresaSubtitulo: "Turnos · Spa",
  empresaEmoji:     "🌿",
  comisionPct:      40,
  professionals:    PROFESSIONALS_DEFAULT.map(p => ({ ...p })),
  services:         SERVICES_DEFAULT.map(s => ({ ...s })),
}
