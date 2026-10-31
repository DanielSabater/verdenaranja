// Compensate for the snapped table rowspan while the dragged edge follows the pointer.
export function resizeCardBounds(preview, cellHeight = 100) {
  if (preview.edge === 'top') {
    return { top: 2 + preview.deltaY - (preview.hourIdx - preview.origHourIdx) * cellHeight, bottom: 2 }
  }
  return { top: 2, bottom: 2 - preview.deltaY + (preview.slots - preview.origSlots) * cellHeight }
}
