import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { buildInventory, shrinkPhoto } from './api.js'
import ClapCatch from './ClapCatch.jsx'
import Inventory from './Inventory.jsx'
import Welcome from './Welcome.jsx'
import VoiceTest from './VoiceTest.jsx'
import CatchTest from './CatchTest.jsx'
import { deleteSpace, loadSpaces, saveSpace } from './savedSpaces.js'
import SpacesPage from './SpacesPage.jsx'
import SpacePicker from './SpacePicker.jsx'
import { askMotionPermission } from './sweep.js'
import './App.css'

// The scanner loads separately, so the welcome screen's loading is real.
const loadScanner = () => import('./Camera.jsx')
const Camera = lazy(loadScanner)

export default function App() {
  // Accuracy test modes: open the app with ?test=catch (voice, no sound recorded) or ?test=claps
  const test = new URLSearchParams(window.location.search).get('test')
  if (test === 'catch' || test === 'claps') return <CatchTest claps={test === 'claps'} />
  if (test === 'high') return <CatchTest high />
  if (test === 'turn') return <div className="app"><ClapCatch players={2} onBack={() => { window.location.search = '?test=menu' }} /></div>
  if (test === 'voice') return <VoiceTest />
  if (test === 'scavenger') return <div className="app"><ClapCatch players={2} gameType="scavenger" onBack={() => { window.location.search = '?test=menu' }} /></div>
  if (test === 'menu') return <TestMenu />
  return <Game />
}

// Shortcuts for testing, so nobody has to scan a room first. Open the app with ?test=menu
function TestMenu() {
  const links = [
    ['turn', '👏 Play Clap Catch', 'Names, rounds, turns, scoreboard and the full report. No scan.'],
    ['scavenger', '🔎 Play Room Scavenger', 'No scan, so it uses general clues instead of your room.'],
    ['voice', '🔊 Voice test', 'Can the phone speak while filming, with the mic open or closed? About 2 minutes.'],
    ['catch', '🗣️ Catch test', '20 throws called out by voice, about 4 minutes. No mic.'],
    ['high', '🚀 High throw test', '10 throws that leave the top of the frame, about 4 minutes. Turn off any ceiling fan first.'],
    ['claps', '🔢 Clap test', '13 throws with the mic on, about 2.5 minutes. Read the screen.'],
  ]
  return (
    <div className="app">
      <main>
        <h1>Test menu</h1>
        {links.map(([key, title, about]) => (
          <a key={key} className="card game test-link" href={`?test=${key}`}>
            <h3>{title}</h3>
            <p className="meta">{about}</p>
          </a>
        ))}
        <a className="link" href="/">Full app →</a>
      </main>
    </div>
  )
}

function Game() {
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
        />
      )}
    </>
  )
}
