// Half-open bounds assign a shared divider to the cell on its right/below.
export function gridBorderTarget(x, y, columns, rows) {
  const row = rows.find(row => y >= row.top && y < row.bottom)
  const column = columns.find(column => x >= column.left && x < column.right)
  return row && column ? { profId: column.profId, hour: row.hour } : null
}
