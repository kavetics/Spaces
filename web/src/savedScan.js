// Keeps the latest scan on the phone, so its photos and results survive sleep and reloads.
const DB = 'spaces'
const STORE = 'scan'
const KEY = 'latest'

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run(mode, work) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = work(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

// Storage can be unavailable (private browsing, full phone): the scan still works, it just can't come back.
const quietly = promise => promise.catch(err => { console.warn('Scan not saved:', err); return undefined })

/** scan: { frames: Blob[], result: inventory or null, savedAt: ms } */
export const saveScan = scan => quietly(run('readwrite', s => s.put(scan, KEY)))
export const loadScan = () => quietly(run('readonly', s => s.get(KEY)))
export const deleteScan = () => quietly(run('readwrite', s => s.delete(KEY)))
