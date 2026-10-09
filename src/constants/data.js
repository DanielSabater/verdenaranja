import { C } from './colors.js'

export const APP_VERSION = "v1.2.0"

export const PROFESSIONALS_DEFAULT = [
  { id: 1, name: "Valentina", emoji: "🌿", rama: "manos" },
  { id: 2, name: "Sofía",     emoji: "🌸", rama: "manos" },
  { id: 3, name: "Camila",    emoji: "✨", rama: "manos" },
  { id: 4, name: "Isabella",  emoji: "🍃", rama: "manos" },
  { id: 5, name: "Luciana",   emoji: "🌺", rama: "manos" },
]

export const SERVICES_DEFAULT = [
  { id: 1, name: "Manicura clásica",        duration: 45,  price: 3500,  category: "manos", icon: "💅", rama: "manos" },
  { id: 2, name: "Manicura semipermanente", duration: 60,  price: 5500,  category: "manos", icon: "💎", rama: "manos" },
  { id: 3, name: "Nail art",                duration: 90,  price: 7500,  category: "manos", icon: "🎨", rama: "manos" },
  { id: 302, name: "Nail art por 2",        duration: 180, price: 15000, category: "manos", icon: "🎨", rama: "manos" },
  { id: 303, name: "Nail art por 3",        duration: 270, price: 22500, category: "manos", icon: "🎨", rama: "manos" },
  { id: 304, name: "Nail art por 4",        duration: 360, price: 30000, category: "manos", icon: "🎨", rama: "manos" },
  { id: 305, name: "Nail art por 5",        duration: 450, price: 37500, category: "manos", icon: "🎨", rama: "manos" },
  { id: 4, name: "Pedicura clásica",        duration: 60,  price: 4500,  category: "pies",  icon: "🦶", rama: "manos" },
  { id: 5, name: "Pedicura semipermanente", duration: 75,  price: 6500,  category: "pies",  icon: "✨", rama: "manos" },
  { id: 6, name: "Spa de pies",             duration: 90,  price: 8500,  category: "pies",  icon: "🌺", rama: "manos" },
  { id: 7, name: "Manos + Pies clásico",    duration: 90,  price: 7000,  category: "combo", icon: "🌸", rama: "manos" },
  { id: 8, name: "Manos + Pies semi",       duration: 120, price: 10500, category: "combo", icon: "👑", rama: "manos" },
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
  gridStyle:        "cards",
  premiumLoading:   true,
  waReminderMins:   15,
  waOpenMode:       "app",
  waReminderTemplate: "¡Hola {cliente}! 🌿 Te recordamos tu turno en {empresa} para {dia} a las {hora} hs con {profesional} ({servicios}).\n¡Te esperamos! 💅✨",
  modalTone:        "verde",
  modalOpacityLevel: 4,
  modalBlurLevel:   3,
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

// ── Opciones de Fondo / Overlay para Modales ──

export const MODAL_TONES = [
  { id: "verde",   name: "Verde Botánico", isDefault: true,  rgb: "20, 40, 24",   hex: "#142818", desc: "Original de la marca" },
  { id: "negro",   name: "Negro Neutro",   isDefault: false, rgb: "0, 0, 0",      hex: "#050505", desc: "Estilo Apple puro" },
  { id: "grafito", name: "Gris Grafito",   isDefault: false, rgb: "28, 34, 44",   hex: "#1c222c", desc: "Sobrio y moderno" },
  { id: "calido",  name: "Cálido / Tierra",isDefault: false, rgb: "46, 28, 20",   hex: "#2e1c14", desc: "Tonos tierra acogedores" },
  { id: "ciruela", name: "Ciruela / Vino", isDefault: false, rgb: "42, 20, 38",   hex: "#2a1426", desc: "Elegante y nocturno" },
  { id: "marino",  name: "Azul Marino",    isDefault: false, rgb: "14, 28, 48",   hex: "#0e1c30", desc: "Profundo y sereno" },
]

export const MODAL_OPACITY_DEFAULT_LEVEL = 4 // Nivel 4 = 40% (0.40)
export const MODAL_OPACITY_LEVELS = {
  1:  { alpha: 0.15, label: "15%", desc: "Muy transparente" },
  2:  { alpha: 0.22, label: "22%", desc: "Translúcido alto" },
  3:  { alpha: 0.30, label: "30%", desc: "Translúcido medio" },
  4:  { alpha: 0.40, label: "40%", desc: "Equilibrado (Por defecto)", isDefault: true },
  5:  { alpha: 0.50, label: "50%", desc: "Medio" },
  6:  { alpha: 0.60, label: "60%", desc: "Sólido suave" },
  7:  { alpha: 0.70, label: "70%", desc: "Sólido moderado" },
  8:  { alpha: 0.80, label: "80%", desc: "Oscuro" },
  9:  { alpha: 0.88, label: "88%", desc: "Muy oscuro" },
  10: { alpha: 0.95, label: "95%", desc: "Casi opaco" },
}

export const MODAL_BLUR_DEFAULT_LEVEL = 3 // Nivel 3 = 5px (original)
export const MODAL_BLUR_LEVELS = {
  1:  { blur: 0,  label: "0px",  desc: "Sin desenfoque (Nítido)" },
  2:  { blur: 2,  label: "2px",  desc: "Sutil" },
  3:  { blur: 5,  label: "5px",  desc: "Clásico (Por defecto)", isDefault: true },
  4:  { blur: 8,  label: "8px",  desc: "Suave" },
  5:  { blur: 11, label: "11px", desc: "Moderado" },
  6:  { blur: 14, label: "14px", desc: "Apple Glass" },
  7:  { blur: 18, label: "18px", desc: "Intenso" },
  8:  { blur: 24, label: "24px", desc: "Profundo" },
  9:  { blur: 32, label: "32px", desc: "Ultra difuso" },
  10: { blur: 44, label: "44px", desc: "Frosted Glass total" },
}

export const getModalOverlayStyle = (config = {}) => {
  const toneId    = config?.modalTone || "verde"
  const toneObj   = MODAL_TONES.find(t => t.id === toneId) || MODAL_TONES[0]
  const opLevel   = config?.modalOpacityLevel ?? MODAL_OPACITY_DEFAULT_LEVEL
  const blurLevel = config?.modalBlurLevel ?? MODAL_BLUR_DEFAULT_LEVEL

  const alpha = (MODAL_OPACITY_LEVELS[opLevel] || MODAL_OPACITY_LEVELS[MODAL_OPACITY_DEFAULT_LEVEL]).alpha
  const blur  = (MODAL_BLUR_LEVELS[blurLevel] || MODAL_BLUR_LEVELS[MODAL_BLUR_DEFAULT_LEVEL]).blur

  const background = `rgba(${toneObj.rgb}, ${alpha})`
  const backdropFilter = blur > 0 ? `blur(${blur}px)` : "none"

  return {
    background,
    backdropFilter,
    WebkitBackdropFilter: backdropFilter,
  }
}
