const serviceKey = service => service.id || service.name

// Conservar la relevancia habitual y el orden del catálogo dentro de cada grupo.
export function orderAppointmentServices(filteredServices, chosenServices, usualServices) {
  const selected = new Set(chosenServices.map(serviceKey))
  const counts = new Map(usualServices.map(service => [serviceKey(service), service.count]))
  return [...filteredServices].sort((a, b) =>
    Number(selected.has(serviceKey(b))) - Number(selected.has(serviceKey(a)))
    || (counts.get(serviceKey(b)) || 0) - (counts.get(serviceKey(a)) || 0)
  )
}
