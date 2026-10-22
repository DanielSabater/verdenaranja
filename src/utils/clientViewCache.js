// Conserva un resultado por cálculo entre aperturas; invalida por referencias y fecha.
const entries = new Map()
export function reuseClientViewCalculation(key, dependencies, calculate) {
  const previous = entries.get(key)
  if (previous && dependencies.length === previous.dependencies.length && dependencies.every((value, index) => Object.is(value, previous.dependencies[index]))) return previous.value
  const value = calculate()
  entries.set(key, { dependencies: [...dependencies], value })
  return value
}
