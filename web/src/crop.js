// Cutting an item out of its scan photo, for lists, details and citations.
export const CROP_PX = 160 // crops are shown small, at twice their size for sharp phone screens
const CROP_PADDING = 0.15 // a little of the surroundings makes an item easier to recognize
const WIDE_PADDING = 1.5 // when the tight crop failed its check, show the item in context

/** Cuts an item out of its photo. The box is in fractions of the photo. */
export async function cropItem(frame, { box, wide }, px = CROP_PX) {
  const bitmap = await createImageBitmap(frame)
  const padding = wide ? WIDE_PADDING : CROP_PADDING
  const padX = (box.x2 - box.x1) * padding
  const padY = (box.y2 - box.y1) * padding
  const x1 = Math.max(0, box.x1 - padX) * bitmap.width
  const y1 = Math.max(0, box.y1 - padY) * bitmap.height
  const x2 = Math.min(1, box.x2 + padX) * bitmap.width
  const y2 = Math.min(1, box.y2 + padY) * bitmap.height
  const scale = px / Math.max(x2 - x1, y2 - y1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((x2 - x1) * scale))
  canvas.height = Math.max(1, Math.round((y2 - y1) * scale))
  canvas.getContext('2d').drawImage(bitmap, x1, y1, x2 - x1, y2 - y1, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}
