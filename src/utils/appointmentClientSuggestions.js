import { cleanClientName, extractClientPhone, extractPhoneFromString, normalizeStr } from './whatsapp.js'

const normalizeName = value => normalizeStr(cleanClientName(value)).replace(/\s+/g, ' ')
const digits = value => (value || '').replace(/\D/g, '')

export function appointmentClientSuggestions(clientName, clients = []) {
  const raw = (clientName || '').trim().toLowerCase()
  if (!raw) return []
  const rawDigits = digits(raw)
  const queryName = normalizeName(raw)
  const queryPhone = digits(extractClientPhone(raw))

  return clients.filter(client => {
    if (!client?.name) return false
    const name = client.name.toLowerCase()
    const phone = digits(client.phone || extractPhoneFromString(client.name))
    // Una ficha ya identificada no es una alternativa, lleve el teléfono separado o en el nombre.
    const sameClient = queryName && queryName === normalizeName(client.name)
      && (!queryPhone || queryPhone === phone)
    if (sameClient || name === raw) return false
    return name.includes(raw) || cleanClientName(client.name).toLowerCase().includes(raw)
      || (rawDigits.length > 0 && digits(client.phone).includes(rawDigits))
  }).slice(0, 8)
}
