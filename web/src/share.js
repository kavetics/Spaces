// Sends an item to other apps through the phone's share sheet (WhatsApp, Messages, Marketplace...).
// Nothing is posted by Spaces itself: the person picks the app and sends it. Without a share sheet,
// as on most computers, WhatsApp opens with the text filled in, but no photo.
import { useEffect, useState } from 'react'

/**
 * The photo to send, made ready when the screen opens: iPhones only open the share sheet straight
 * after a tap, so there's no time to prepare it then. The first sale photo is sharper, so it wins.
 */
export function useSharePhoto(item) {
  const [file, setFile] = useState(null)
  const source = item.salePhotos?.[0] ?? item.picture
  useEffect(() => {
    let cancelled = false
    const blob = source instanceof Blob ? Promise.resolve(source) : source ? fetch(source).then(r => r.blob()) : Promise.resolve(null)
    blob
      .then(b => { if (!cancelled) setFile(b ? new File([b], 'item.jpg', { type: b.type || 'image/jpeg' }) : null) })
      .catch(() => { if (!cancelled) setFile(null) })
    return () => { cancelled = true }
  }, [source])
  return file
}

/** Call straight from a tap. Returns 'shared', 'cancelled' or 'whatsapp' (the fallback). */
export async function shareItem(file, text) {
  const withPhoto = file && navigator.canShare?.({ files: [file], text })
  if (navigator.share) {
    try {
      await navigator.share(withPhoto ? { files: [file], text } : { text })
      return 'shared'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled'
      // Some browsers refuse a share they said they could do; fall through to WhatsApp.
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  return 'whatsapp'
}

export const familyQuestion = (item, spaceName) =>
  `Keep, sell or let go? Our ${item.name} from ${spaceName}. Reply with your vote.`
