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

/** space: { id, spaceName, frames: Blob[], result, itemChoices, createdAt, savedAt } */
export const saveSpace = space => quietly(run('readwrite', s => s.put(space)))
export const deleteSpace = id => quietly(run('readwrite', s => s.delete(id)))
export const loadSpaces = () => quietly(run('readonly', s => s.getAll()))
  .then(spaces => (spaces ?? []).sort((a, b) => a.createdAt - b.createdAt))

// One saved chat per Space, plus 'all' for the one about every Space.
export const saveChat = (key, messages) => quietly(run('readwrite', s => s.put(messages, key), CHATS))
export const loadChat = key => quietly(run('readonly', s => s.get(key), CHATS))
export const deleteChat = key => quietly(run('readwrite', s => s.delete(key), CHATS))
