// Pictures of items, cut from the scan photos. Each is made once after a scan and saved as a small
// image, because decoding a full scan photo for every picture, every time a screen opens, runs
// iPhones out of memory and leaves pictures blank.
export const PICTURE_PX = 480 // big enough for the item page and Declutter cards, small enough to store
const COVER_PX = 320
const CROP_PADDING = 0.15 // a little of the surroundings makes an item easier to recognize
const WIDE_PADDING = 1.5 // when the tight crop failed its check, show the item in context

/** Decodes a photo, with a fallback for browsers whose createImageBitmap can't read it. */
async function decode(blob) {
  try {
    return await createImageBitmap(blob)
  } catch {
    const url = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

const release = image => image.close?.()
const sizeOf = image => ({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height })

function draw(image, x1, y1, x2, y2, px) {
  const scale = Math.min(1, px / Math.max(x2 - x1, y2 - y1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((x2 - x1) * scale))
  canvas.height = Math.max(1, Math.round((y2 - y1) * scale))
  canvas.getContext('2d').drawImage(image, x1, y1, x2 - x1, y2 - y1, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.8)
}

/** Cuts an item out of an already decoded photo. The box is in fractions of the photo. */
function cut(image, { box, wide }, px) {
  const { width, height } = sizeOf(image)
  const padding = wide ? WIDE_PADDING : CROP_PADDING
  const padX = (box.x2 - box.x1) * padding
  const padY = (box.y2 - box.y1) * padding
  return draw(image,
    Math.max(0, box.x1 - padX) * width, Math.max(0, box.y1 - padY) * height,
    Math.min(1, box.x2 + padX) * width, Math.min(1, box.y2 + padY) * height, px)
}

/** Cuts one item out of its photo, decoding the photo just for it. */
export async function cropItem(frame, view, px = PICTURE_PX) {
  const image = await decode(frame)
  try { return cut(image, view, px) } finally { release(image) }
}

/**
 * Every item's picture and the Space's cover, decoding each scan photo only once, one at a time.
 * A photo that can't be read just leaves its items without pictures.
 */
export async function makePictures(space) {
  const items = space.result?.items ?? []
  const pictures = {}
  let cover = null
  for (let photo = 0; photo < space.frames.length; photo++) {
    const onThisPhoto = items.filter(i => i.view?.photo === photo)
    if (!onThisPhoto.length && photo !== 0) continue
    let image
    try {
      image = await decode(space.frames[photo])
      const { width, height } = sizeOf(image)
      if (photo === 0) cover = draw(image, 0, 0, width, height, COVER_PX)
      for (const item of onThisPhoto) pictures[item.id] = cut(image, item.view, PICTURE_PX)
    } catch (err) {
      console.warn(`Couldn't read scan photo ${photo}:`, err)
    } finally {
      if (image) release(image)
    }
  }
  return { pictures, cover }
}

/** A whole photo as a saved picture, for items people add by hand. */
export async function pictureOf(photo) {
  const image = await decode(photo)
  try {
    const { width, height } = sizeOf(image)
    return draw(image, 0, 0, width, height, PICTURE_PX)
  } finally {
    release(image)
  }
}

/** Whether a Space still needs its pictures made. */
export const needsPictures = space => Boolean(space.result) && (space.cover == null || space.result.items.some(i => i.view && !i.picture))
