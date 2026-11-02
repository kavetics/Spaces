import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { shrinkPhoto } from './api.js'
import ClapCatch from './ClapCatch.jsx'
import Inventory from './Inventory.jsx'
import Welcome from './Welcome.jsx'
import VoiceTest from './VoiceTest.jsx'
import CatchTest from './CatchTest.jsx'
import { deleteScan, loadScan, saveScan } from './savedScan.js'
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
  const [screen, setScreen] = useState(null) // null while checking for a saved scan, then home → space → scan → inventory
  const [scan, setScan] = useState(null) // { frames, spaceName, result, areaChoices, savedAt }
  const [spaceName, setSpaceName] = useState('')
  const fileInput = useRef(null)

  // A saved scan picks up where it left off: its results, or the recognition it never finished.
  useEffect(() => {
    let cancelled = false
    loadScan().then(saved => {
      if (cancelled) return
      if (saved) setScan(saved)
      setScreen(saved ? 'inventory' : 'home')
    })
    return () => { cancelled = true }
  }, [])

  function onPhotoFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) shrinkPhoto(file).then(small => onScan({ frames: [small] }))
  }

  // Save before recognition starts, so a phone going to sleep can't lose the photos.
  function onScan({ frames }) {
    const fresh = { frames, spaceName, result: null, areaChoices: {}, savedAt: Date.now() }
    setScan(fresh)
    saveScan(fresh)
    setScreen('inventory')
  }

  function onResult(result) {
    setScan(current => {
      const done = { ...current, result }
      saveScan(done)
      return done
    })
  }

  // Keep or leave out everything nearby in one area, and remember the choice.
  function onAreaChoice(area, choice) {
    setScan(current => {
      const next = { ...current, areaChoices: { ...current.areaChoices, [area]: choice } }
      saveScan(next)
      return next
    })
  }

  async function onDelete() {
    await deleteScan()
    setScan(null)
    setScreen('home')
  }

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPhotoFile} />

      {screen === 'home' && (
        <Welcome loadScanner={loadScanner} onAccept={() => { askMotionPermission(); setScreen('space') }} />
      )}

      {screen === 'space' && (
        <SpacePicker
          initial={spaceName}
          onPick={name => { setSpaceName(name); setScreen('scan') }}
          onBack={() => setScreen(scan ? 'inventory' : 'home')}
        />
      )}

      {screen === 'scan' && (
        <Suspense>
          <Camera
            title={spaceName}
            hint="Stand in the middle of the space. Tap Start scan, then turn slowly to the right when told."
            onCapture={onScan}
            onBack={() => setScreen('space')}
            onUpload={() => fileInput.current?.click()}
          />
        </Suspense>
      )}

      {screen === 'inventory' && <Inventory scan={scan} onResult={onResult} onAreaChoice={onAreaChoice} onDelete={onDelete} onScanAgain={() => setScreen('space')} />}
    </>
  )
}
