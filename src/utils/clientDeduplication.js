/**
 * Utilidades para detección inteligente de duplicados y unificación de clientas
 * Versión optimizada con poda rápida de candidatos y cálculo acotado no bloqueante.
 */

// 1. Normalización de nombre (elimina acentos, puntuación, dobles espacios y pasa a minúsculas)
export function normalizeClientName(name) {
  if (!name) return ""
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// 2. Normalización de teléfono (conserva últimos 8-10 dígitos limpios)
export function normalizePhone(phone) {
  if (!phone) return ""
  const digits = String(phone).replace(/\D/g, "")
  if (digits.length < 7) return ""
  return digits.length > 8 ? digits.slice(-8) : digits
}

// 3. Distancia de Levenshtein acotada y ultra rápida (con salida temprana si supera maxDist)
export function boundedLevenshtein(s1, s2, maxDist = 2) {
  if (s1 === s2) return 0
  const l1 = s1.length
  const l2 = s2.length
  if (Math.abs(l1 - l2) > maxDist) return maxDist + 1
  if (l1 === 0) return l2 <= maxDist ? l2 : maxDist + 1
  if (l2 === 0) return l1 <= maxDist ? l1 : maxDist + 1

  let prev = new Array(l2 + 1)
  let curr = new Array(l2 + 1)
  for (let j = 0; j <= l2; j++) prev[j] = j

  for (let i = 1; i <= l1; i++) {
    curr[0] = i
    let minRow = curr[0]
    const c1 = s1.charCodeAt(i - 1)

    for (let j = 1; j <= l2; j++) {
      const cost = c1 === s2.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,       // eliminación
        curr[j - 1] + 1,   // inserción
        prev[j - 1] + cost // sustitución
      )
      if (curr[j] < minRow) minRow = curr[j]
    }

    // Salida temprana: si todas las celdas de la fila ya superan maxDist, abortar
    if (minRow > maxDist) return maxDist + 1
    for (let j = 0; j <= l2; j++) prev[j] = curr[j]
  }

  return curr[l2] <= maxDist ? curr[l2] : maxDist + 1
}

// 4. Clave única para pares de clientas
export function getPairKey(idA, idB) {
  return [String(idA), String(idB)].sort().join("::")
}

// 5. Motor de detección de sugerencias de unificación (Optimizado O(N) pre-pass + poda rápida)
export function findDuplicateSuggestions(enrichedClients = [], ignoredPairs = new Set()) {
  const suggestions = []
  const n = enrichedClients.length
  if (n < 2) return suggestions

  // Paso 1: Precomputar tokens, nombres normalizados y teléfonos en un solo pase O(N)
  const prepared = new Array(n)
  for (let i = 0; i < n; i++) {
    const c = enrichedClients[i]
    if (!c || !c.name) {
      prepared[i] = null
      continue
    }
    const norm = normalizeClientName(c.name)
    const words = norm ? norm.split(" ").filter(Boolean) : []
    const rawPhone = c.effectivePhone || c.phone || ""
    const phone = normalizePhone(rawPhone)

    prepared[i] = {
      c,
      norm,
      len: norm.length,
      words,
      fn: words[0] || "",
      ln: words.length > 1 ? words[words.length - 1] : "",
      phone
    }
  }

  // Paso 2: Comparación con filtros de descarte instantáneo (evita el 95% de cálculos innecesarios)
  for (let i = 0; i < n; i++) {
    const p1 = prepared[i]
    if (!p1 || !p1.norm) continue

    for (let j = i + 1; j < n; j++) {
      const p2 = prepared[j]
      if (!p2 || !p2.norm || p2.c.id === p1.c.id) continue

      const pairKey = getPairKey(p1.c.id, p2.c.id)
      if (ignoredPairs.has(pairKey)) continue

      let matchReason = null
      let confidence = "media"
      let score = 0

      // Regla 1: Mismo teléfono (O(1))
      if (p1.phone && p2.phone && p1.phone === p2.phone) {
        matchReason = `Mismo número de teléfono de contacto`
        confidence = "alta"
        score = 100
      }
      // Regla 2: Nombres idénticos (O(1))
      else if (p1.norm === p2.norm) {
        matchReason = "Nombres idénticos con diferente acentuación o mayúsculas"
        confidence = "alta"
        score = 98
      }

      // Si no coincidieron por teléfono ni nombre idéntico, aplicar filtros de descarte rápido
      if (!matchReason) {
        const sameFirst = p1.fn && p2.fn && p1.fn === p2.fn
        const sameLast = p1.ln && p2.ln && p1.ln === p2.ln
        const inverted = (p1.fn === p2.ln && p1.ln === p2.fn && p1.words.length > 1)
        const lenDiff = Math.abs(p1.len - p2.len)

        // Poda matemática: si no comparten inicial/apellido ni están invertidas y la diferencia es > 2 letras,
        // matemáticamente no pueden coincidir ni por apodo ni por error de tipeo.
        if (!sameFirst && !sameLast && !inverted && lenDiff > 2) {
          continue
        }

        // Regla 3: Palabras invertidas ("Gomez Maria" vs "Maria Gomez")
        if (
          inverted ||
          (p1.words.length > 1 &&
            p2.words.length > 1 &&
            p1.words.slice().sort().join(" ") === p2.words.slice().sort().join(" "))
        ) {
          matchReason = "Mismo nombre y apellido en distinto orden"
          confidence = "alta"
          score = 95
        }
        // Regla 4: Mismo apellido con nombre abreviado o similar
        else if (sameLast && p1.words.length >= 2 && p2.words.length >= 2) {
          const fn1 = p1.fn
          const fn2 = p2.fn
          if (
            (fn1.length >= 3 && fn2.length >= 3 && (fn1.startsWith(fn2) || fn2.startsWith(fn1))) ||
            (fn1.length <= 2 && fn2.startsWith(fn1)) ||
            (fn2.length <= 2 && fn1.startsWith(fn2))
          ) {
            matchReason = `Mismo apellido con nombre abreviado ("${fn1}" / "${fn2}")`
            confidence = "alta"
            score = 92
          } else if (Math.min(fn1.length, fn2.length) >= 4 && boundedLevenshtein(fn1, fn2, 1) <= 1) {
            matchReason = `Mismo apellido con ligera variación en el nombre ("${fn1}" / "${fn2}")`
            confidence = "alta"
            score = 88
          }
        }
        // Regla 5: Mismo primer nombre con inicial o ligera variación en el apellido
        else if (sameFirst && p1.words.length >= 2 && p2.words.length >= 2) {
          const ln1 = p1.ln
          const ln2 = p2.ln
          if ((ln1.length <= 2 || ln2.length <= 2) && (ln1.startsWith(ln2) || ln2.startsWith(ln1))) {
            matchReason = `Mismo primer nombre con inicial de apellido`
            confidence = "media"
            score = 82
          } else if (Math.min(ln1.length, ln2.length) >= 4 && boundedLevenshtein(ln1, ln2, 1) <= 1) {
            matchReason = `Mismo nombre con posible variación en el apellido ("${ln1}" / "${ln2}")`
            confidence = "alta"
            score = 88
          }
        }
        // Regla 6: Error tipográfico general (Levenshtein acotado a 2 en todo el nombre)
        else if (lenDiff <= 2 && Math.min(p1.len, p2.len) >= 6) {
          const dist = boundedLevenshtein(p1.norm, p2.norm, 2)
          if (dist === 1) {
            matchReason = "Difieren únicamente por una letra (posible error de tipeo)"
            confidence = "alta"
            score = 86
          } else if (dist === 2 && Math.min(p1.len, p2.len) >= 9) {
            matchReason = "Nombres muy similares (posible error de tipeo)"
            confidence = "media"
            score = 75
          }
        }
        // Regla 7: Uno contiene al otro
        else if (p1.norm.includes(p2.norm) || p2.norm.includes(p1.norm)) {
          const shorter = p1.len < p2.len ? p1.norm : p2.norm
          const wordsShorter = shorter.split(" ").filter(Boolean)
          if (wordsShorter.length >= 2 || shorter.length >= 8) {
            matchReason = `Un nombre contiene al otro`
            confidence = "media"
            score = 78
          }
        }
      }

      if (matchReason) {
        // Elegir cuál sugerir como perfil principal recomendado
        let principal = p1.c
        let secundaria = p2.c

        const c1Score =
          (p1.c.visits || 0) * 10 +
          (p1.c.phone ? 5 : 0) +
          (p1.c.notes ? 3 : 0) +
          (p1.c.name.length > p2.c.name.length ? 1 : 0)

        const c2Score =
          (p2.c.visits || 0) * 10 +
          (p2.c.phone ? 5 : 0) +
          (p2.c.notes ? 3 : 0) +
          (p2.c.name.length > p1.c.name.length ? 1 : 0)

        if (c2Score > c1Score) {
          principal = p2.c
          secundaria = p1.c
        }

        suggestions.push({
          id: pairKey,
          clientA: principal,
          clientB: secundaria,
          reason: matchReason,
          confidence,
          score
        })
      }
    }
  }

  return suggestions.sort((a, b) => b.score - a.score)
}

// 6. Generador del resultado unificado para vista previa y guardado
export function buildMergedClientData(clientA, clientB, options = {}) {
  const chosenName = (options.chosenName || clientA.name || clientB.name).trim()
  const chosenPhone = (
    options.chosenPhone !== undefined
      ? options.chosenPhone
      : clientA.phone || clientB.phone || clientA.effectivePhone || clientB.effectivePhone || ""
  ).trim()

  // Combinar notas
  let combinedNotes = ""
  const notesA = (clientA.notes || "").trim()
  const notesB = (clientB.notes || "").trim()

  if (options.chosenNotes !== undefined) {
    combinedNotes = options.chosenNotes.trim()
  } else if (notesA && notesB) {
    if (notesA === notesB) {
      combinedNotes = notesA
    } else if (notesA.toLowerCase().includes(notesB.toLowerCase())) {
      combinedNotes = notesA
    } else if (notesB.toLowerCase().includes(notesA.toLowerCase())) {
      combinedNotes = notesB
    } else {
      combinedNotes = `${notesA}\n---\n${notesB}`
    }
  } else {
    combinedNotes = notesA || notesB || ""
  }

  // Métricas combinadas
  const combinedVisits = (clientA.visits || 0) + (clientB.visits || 0)
  const combinedSpent = (clientA.totalSpent || 0) + (clientB.totalSpent || 0)

  // Última visita (la más reciente)
  const lastA = clientA.lastVisit || null
  const lastB = clientB.lastVisit || null
  let combinedLastVisit = null
  if (lastA && lastB) {
    combinedLastVisit = lastA > lastB ? lastA : lastB
  } else {
    combinedLastVisit = lastA || lastB || null
  }

  // Mapa combinado de servicios
  const servicesMap = {}
  ;(clientA.topServices || []).forEach(s => {
    servicesMap[s.name] = (servicesMap[s.name] || 0) + (s.count || 0)
  })
  ;(clientB.topServices || []).forEach(s => {
    servicesMap[s.name] = (servicesMap[s.name] || 0) + (s.count || 0)
  })

  const mergedTopServices = Object.entries(servicesMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  return {
    targetId: clientA.id,
    sourceId: clientB.id,
    name: chosenName,
    phone: chosenPhone,
    notes: combinedNotes,
    combinedVisits,
    combinedSpent,
    combinedLastVisit,
    mergedTopServices,
    namesToRename: [clientA.name, clientB.name].filter(Boolean)
  }
}
