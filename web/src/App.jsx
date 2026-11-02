import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { buildInventory, shrinkPhoto } from './api.js'
import AskMuse from './AskMuse.jsx'
import Inventory from './Inventory.jsx'
import { deleteChat, deleteSpace, loadSpaces, saveSpace } from './savedSpaces.js'
import SpacePicker from './SpacePicker.jsx'
import SpacesPage from './SpacesPage.jsx'
import { askMotionPermission } from './sweep.js'
import Welcome from './Welcome.jsx'

// The scanner loads separately, so the welcome screen's loading is real.
const loadScanner = () => import('./Camera.jsx')
const Camera = lazy(loadScanner)

export default function App() {
  const [screen, setScreen] = useState(null) // null while loading, then home → pick → scan → space ⇄ spaces
  const [spaces, setSpaces] = useState([])
  const [openId, setOpenId] = useState(null)
  const [pending, setPending] = useState(null) // the Space about to be scanned: { name, id if rescanning }
  const [failed, setFailed] = useState({}) // id → why recognition stopped
  const [progress, setProgress] = useState(null)
  const running = useRef(null) // only one Space is recognized at a time, since each run costs money
  const fileInput = useRef(null)

  const open = spaces.find(s => s.id === openId)
  const processing = spaces.some(s => !s.result && !failed[s.id])

  useEffect(() => {
    let cancelled = false
    loadSpaces().then(saved => {
      if (cancelled) return
      setSpaces(saved)
      setScreen(saved.length ? 'spaces' : 'home')
    })
    return () => { cancelled = true }
  }, [])

  function change(id, update) {
    setSpaces(current => current.map(s => {
      if (s.id !== id) return s
      const next = update(s)
      saveSpace(next)
      return next
    }))
  }

  // Runs here and not on the Space's screen, so it continues while someone looks at other Spaces.
  // This also restarts a run the phone interrupted by going to sleep.
  useEffect(() => {
    const next = spaces.find(s => !s.result && !failed[s.id])
    if (!next || running.current) return
    running.current = next.id
    setProgress(null)
    buildInventory(next.frames, next.spaceName, setProgress)
      .then(result => change(next.id, s => ({ ...s, result })))
      .catch(err => setFailed(f => ({ ...f, [next.id]: err.message })))
      .finally(() => { running.current = null })
  }, [spaces, failed])

  function onPhotoFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) shrinkPhoto(file).then(small => onScan({ frames: [small] }))
  }

  // Save before recognition starts, so a phone going to sleep can't lose the photos.
  function onScan({ frames }) {
    const previous = spaces.find(s => s.id === pending.id)
    const fresh = {
      id: previous?.id ?? crypto.randomUUID(),
      spaceName: pending.name,
      frames,
      result: null,
      itemChoices: {},
      createdAt: previous?.createdAt ?? Date.now(),
      savedAt: Date.now(),
    }
    saveSpace(fresh)
    if (previous) deleteChat(previous.id) // it was about the items this scan replaces
    setSpaces(current => (previous ? current.map(s => (s.id === fresh.id ? fresh : s)) : [...current, fresh]))
    setFailed(({ [fresh.id]: _, ...rest }) => rest)
    setOpenId(fresh.id)
    setScreen('space')
  }

  // Photos can only be taken after motion access, which iPhones only grant from a tap like this one.
  function startScan(name, id) {
    askMotionPermission()
    setPending({ name, id })
    setScreen('scan')
  }

  function onPick(name) {
    const existing = spaces.find(s => s.spaceName.toLowerCase() === name.toLowerCase())
    startScan(existing?.spaceName ?? name, existing?.id)
  }

  // Deletes the item and returns how to put it back. A rescan in between makes that do nothing.
  function removeItem(id, item) {
    const { savedAt, result } = spaces.find(s => s.id === id)
    const position = result.items.findIndex(i => i.id === item.id)
    change(id, s => ({ ...s, result: { ...s.result, items: s.result.items.filter(i => i.id !== item.id) } }))
    return () => change(id, s => {
      if (s.savedAt !== savedAt || s.result?.items.some(i => i.id === item.id)) return s
      const items = [...s.result.items]
      items.splice(position, 0, item)
      return { ...s, result: { ...s.result, items } }
    })
  }

  async function onDelete() {
    await deleteSpace(open.id)
    deleteChat(open.id)
    const left = spaces.filter(s => s.id !== open.id)
    setSpaces(left)
    setOpenId(null)
    setScreen(left.length ? 'spaces' : 'home')
  }

  const leaveScanner = () => {
    if (pending?.id) setScreen('space')
    else setScreen('pick')
  }

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPhotoFile} />

      {screen === 'home' && <Welcome loadScanner={loadScanner} onAccept={() => setScreen('pick')} />}

      {screen === 'spaces' && (
        <SpacesPage
          spaces={spaces}
          failed={failed}
          processing={processing}
          onOpen={id => { setOpenId(id); setScreen('space') }}
          onScanAnother={() => setScreen('pick')}
          onAsk={() => setScreen('ask-all')}
        />
      )}

      {screen === 'pick' && (
        <SpacePicker
          usedNames={spaces.map(s => s.spaceName)}
          onPick={onPick}
          onBack={() => setScreen(spaces.length ? 'spaces' : 'home')}
        />
      )}

      {screen === 'scan' && (
        <Suspense>
          <Camera
            title={pending.name}
            hint="Stand in the middle of the space. Tap Start scan, then turn slowly to the right when told."
            onCapture={onScan}
            onBack={leaveScanner}
            onUpload={() => fileInput.current?.click()}
          />
        </Suspense>
      )}

      {screen === 'space' && open && (
        <Inventory
          key={open.id}
          space={open}
          progress={running.current === open.id ? progress : null}
          error={failed[open.id]}
          onRetry={() => setFailed(({ [open.id]: _, ...rest }) => rest)}
          onItemChoice={(item, choice) => change(open.id, s => ({ ...s, itemChoices: { ...s.itemChoices, [item]: choice } }))}
          onRemoveItem={item => removeItem(open.id, item)}
          onSectionToggle={(key, isOpen) => change(open.id, s => ({ ...s, openSections: { ...s.openSections, [key]: isOpen } }))}
          onDelete={onDelete}
          onRescan={() => startScan(open.spaceName, open.id)}
          onBack={() => setScreen('spaces')}
          onAsk={() => setScreen('ask-space')}
        />
      )}

      {screen === 'ask-all' && <AskMuse spaces={spaces} space={null} onBack={() => setScreen('spaces')} />}
      {screen === 'ask-space' && open && <AskMuse key={open.id} spaces={spaces} space={open} onBack={() => setScreen('space')} />}
    </>
  )
}
