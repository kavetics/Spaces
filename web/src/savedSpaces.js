// Keeps every Space on the phone, so photos and results survive sleep and reloads.
const DB = 'spaces'
const STORE = 'spaces'
const CHATS = 'chats'

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 3)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CHATS)) db.createObjectStore(CHATS)
      if (db.objectStoreNames.contains(STORE)) return
      const spaces = db.createObjectStore(STORE, { keyPath: 'id' })
      // Version 1 held only the latest scan. It becomes the first Space.
      if (!db.objectStoreNames.contains('scan')) return
      const old = request.transaction.objectStore('scan').get('latest')
      old.onsuccess = () => {
        const scan = old.result
        if (scan) spaces.put({ ...scan, id: crypto.randomUUID(), spaceName: scan.spaceName || 'My room', createdAt: scan.savedAt })
        db.deleteObjectStore('scan')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run(mode, work, store = STORE) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const request = work(tx.objectStore(store))
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

// Storage can be unavailable (private browsing, full phone): scanning still works, it just can't come back.
const quietly = promise => promise.catch(err => { console.warn('Space not saved:', err); return undefined })

// iPhone browsers can lose photos saved as Blobs in this storage after a reload, so photos are saved as
// plain bytes and turned back into Blobs when loaded. Converting is cached, since a Space is saved often.
const bytesOf = new WeakMap()
async function toStored(blob) {
  if (!(blob instanceof Blob)) return blob
  if (!bytesOf.has(blob)) bytesOf.set(blob, { bytes: await blob.arrayBuffer(), type: blob.type || 'image/jpeg' })
  return bytesOf.get(blob)
}
function fromStored(photo) {
  if (photo instanceof Blob || !photo?.bytes) return photo
  const blob = new Blob([photo.bytes], { type: photo.type })
  bytesOf.set(blob, photo)
  return blob
}

async function storable(space) {
  const items = space.result?.items
  return {
    ...space,
    frames: await Promise.all(space.frames.map(toStored)),
    ...(space.addFrames && { addFrames: await Promise.all(space.addFrames.map(toStored)) }),
    ...(items && { result: { ...space.result, items: await Promise.all(items.map(async i => (i.salePhotos ? { ...i, salePhotos: await Promise.all(i.salePhotos.map(toStored)) } : i))) } }),
  }
}

function usable(space) {
  const items = space.result?.items
  return {
    ...space,
    frames: space.frames.map(fromStored),
    ...(space.addFrames && { addFrames: space.addFrames.map(fromStored) }),
    ...(items && { result: { ...space.result, items: items.map(i => (i.salePhotos ? { ...i, salePhotos: i.salePhotos.map(fromStored) } : i)) } }),
  }
}

// Saves of one Space happen one after another, so a slow earlier save can't overwrite a newer one.
const pending = new Map()

/** space: { id, spaceName, frames: Blob[], result, itemChoices, cover, createdAt, savedAt } */
export function saveSpace(space) {
  const next = (pending.get(space.id) ?? Promise.resolve())
    .then(() => storable(space))
    .then(stored => run('readwrite', s => s.put(stored)))
  pending.set(space.id, quietly(next))
  return pending.get(space.id)
}
export const deleteSpace = id => quietly((pending.get(id) ?? Promise.resolve()).then(() => run('readwrite', s => s.delete(id))))
export const loadSpaces = () => quietly(run('readonly', s => s.getAll()))
  .then(spaces => (spaces ?? []).map(usable).sort((a, b) => a.createdAt - b.createdAt))

// The Ask Muse chat is saved under 'all'. The same store keeps each Space's Declutter place under
// 'declutter:<id>', and the household list under 'people'.
export const saveChat = (key, messages) => quietly(run('readwrite', s => s.put(messages, key), CHATS))
export const loadChat = key => quietly(run('readonly', s => s.get(key), CHATS))
export const deleteChat = key => quietly(run('readwrite', s => s.delete(key), CHATS))

/** people: [{ id, name, relationship, phone, spaceIds }]. Only on this phone. */
export const savePeople = people => saveChat('people', people)
export const loadPeople = () => loadChat('people').then(people => people ?? [])
