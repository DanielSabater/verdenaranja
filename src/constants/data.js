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
  dynamicDateColors: true,
  blockedColor:     "rojo",
  blockedOpacity:   3,
}

export const BLOCKED_COLORS = [
  { id: "rojo", name: "Rojo (Original)", rgb: "192, 64, 64", hex: "#c04040" },
  { id: "verde", name: "Verde", rgb: "58, 125, 68", hex: "#3a7d44" },
  { id: "naranja", name: "Naranja", rgb: "232, 121, 58", hex: "#e8793a" },
  { id: "gris", name: "Gris", rgb: "112, 128, 144", hex: "#708090" },
  { id: "violeta", name: "Violeta", rgb: "138, 43, 226", hex: "#8a2be2" },
  { id: "rosa", name: "Rosa", rgb: "255, 105, 180", hex: "#ff69b4" },
  { id: "azul", name: "Azul", rgb: "70, 130, 180", hex: "#4682b4" },
  { id: "marron", name: "Marrón", rgb: "139, 69, 19", hex: "#8b4513" },
]

export const getBlockedAlphas = (level) => {
  const alphas = {
    1: { a1: 0.01, a2: 0.03, border: 0.08 },
    2: { a1: 0.02, a2: 0.05, border: 0.14 },
    3: { a1: 0.03, a2: 0.08, border: 0.20 },
    4: { a1: 0.05, a2: 0.12, border: 0.28 },
    5: { a1: 0.08, a2: 0.18, border: 0.38 },
    6: { a1: 0.12, a2: 0.25, border: 0.50 },
    7: { a1: 0.16, a2: 0.32, border: 0.62 },
    8: { a1: 0.20, a2: 0.40, border: 0.74 },
    9: { a1: 0.25, a2: 0.50, border: 0.86 },
    10: { a1: 0.32, a2: 0.65, border: 0.98 },
  }
  return alphas[level] || alphas[3]
}
