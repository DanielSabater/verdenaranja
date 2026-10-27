import { cleanClientName, extractPhoneFromString } from './whatsapp.js'

export const normalizeClientQuery = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

/** Menor puntaje implica mayor coincidencia; no modifica la ficha de la clienta. */
export function clientSearchRank(client, search) {
  const query = normalizeClientQuery(search)
  if (!query) return 0
  const rawName = normalizeClientQuery(client.name)
  const queryDigits = query.replace(/\D/g, '')
  const numbers = [client.phone, client.effectivePhone, extractPhoneFromString(client.name), ...(String(client.name || '').match(/\d{4,}/g) || [])]
    .map(value => String(value || '').replace(/\D/g, '')).filter(Boolean)
  if (queryDigits && numbers.some(number => number === queryDigits)) return 0
  const name = normalizeClientQuery(cleanClientName(client.name)).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  const words = name.split(' ')
  if (name === query) return 0
  if (name.startsWith(`${query} `)) return 1
  if (words.includes(query)) return 2
  if (name.startsWith(query)) return 3
  if (words.some(word => word.startsWith(query))) return 4
  if (rawName.includes(query)) return 5
  if (normalizeClientQuery(client.effectivePhone || client.phone).includes(query)) return 6
  if (queryDigits && numbers.some(number => number.includes(queryDigits) || (number.length >= 4 && queryDigits.includes(number)))) return 6
  if (normalizeClientQuery(client.notes).includes(query)) return 7
  if ((client.topServices || []).some(service => normalizeClientQuery(service.name).includes(query))) return 8
  return Infinity
}
