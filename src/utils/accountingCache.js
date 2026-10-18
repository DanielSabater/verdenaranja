// Cada conjunto de turnos conserva solo el último resultado de cada cálculo.
// WeakMap permite liberar resultados cuando se descartan los datos de esa sesión.
const calculations = new WeakMap()

export function reuseAccountingCalculation(scope, key, calculate, dependencies) {
  let entries = calculations.get(scope)
  if (!entries) {
    entries = new Map()
    calculations.set(scope, entries)
  }
  const previous = entries.get(key)
  if (previous && previous.dependencies.length === dependencies.length &&
      dependencies.every((value, index) => Object.is(value, previous.dependencies[index]))) {
    return previous.value
  }
  const value = calculate()
  entries.set(key, { dependencies: [...dependencies], value })
  return value
}
