import { cleanClientName, ensurePhoneInName, extractClientPhone, extractPhoneFromString, extractNumberFromText, normalizeStr } from './whatsapp.js'

const normalizeName = value => normalizeStr(cleanClientName(value)).replace(/\s+/g, ' ')
const digits = value => (value || '').replace(/\D/g, '')

export function clientSuggestionDetails(client) {
  const embeddedPhone = extractNumberFromText(client.name)
  return {
    name: cleanClientName(embeddedPhone ? client.name.replace(embeddedPhone, '') : client.name) || client.name,
    phone: String(client.phone || embeddedPhone || '').trim(),
  }
}

export function appointmentClientSuggestions(clientName, clients = []) {
  const raw = (clientName || '').trim().toLowerCase()
  if (!raw) return []
  const rawDigits = digits(raw)
  const queryName = normalizeName(raw)
  const queryPhone = digits(extractClientPhone(raw))

  return clients.map((client, index) => {
    if (!client?.name) return null
    const name = client.name.toLowerCase()
    const phone = digits(client.phone || extractPhoneFromString(client.name))
    // El nombre completo sigue ofreciendo la ficha hasta completar también su teléfono.
    const sameClient = queryName && queryName === normalizeName(client.name)
      && queryPhone.length >= 8 && queryPhone === phone
    if (sameClient || (!phone && name === raw)) return null
    const numericParts = [phone, ...(client.name.match(/\d{4,}/g) || [])].filter(Boolean)
    let rank = Infinity
    if (rawDigits && numericParts.some(part => part === rawDigits)) rank = 0
    else if (rawDigits && numericParts.some(part => part.includes(rawDigits))) rank = 1
    // Un número abreviado guardado en el nombre también puede estar dentro de uno completo.
    else if (rawDigits && numericParts.some(part => part.length >= 4 && rawDigits.includes(part))) rank = 2
    if (!rawDigits && queryName && normalizeName(client.name).includes(queryName)) rank = Math.min(rank, 3)
    if (name.includes(raw) || cleanClientName(client.name).toLowerCase().includes(raw)) rank = Math.min(rank, 3)
    return Number.isFinite(rank) ? { client, rank, index } : null
  }).filter(Boolean).sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, 8).map(result => result.client)
}

export function suggestedClientValue(_query, client) {
  // Reemplazar por los datos guardados, incluyendo el teléfono estructurado de la ficha.
  return ensurePhoneInName(client.name, client.phone || extractPhoneFromString(client.name))
}

export function savedClientForValue(value, clients = []) {
  const normalize = text => normalizeStr(text || '').replace(/\s+/g, ' ')
  const raw = (value || '').trim()
  if (!raw) return null
  return clients.find(client => {
    if (!client?.name) return false
    const phone = client.phone || extractPhoneFromString(client.name)
    return normalize(raw) === normalize(client.name) || normalize(raw) === normalize(ensurePhoneInName(client.name, phone))
  }) || null
}

export function addClientDraft(clients, value, phone, id) {
  const list = Array.isArray(clients) ? clients : []
  const name = ensurePhoneInName(value, phone)
  if (!name.trim() || savedClientForValue(name, list)) return list
  return [...list, { id, name, phone: phone || '', notes: '' }]
}
