import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { buildInventory, findRepeats, shrinkPhoto } from './api.js'
import AskMuse from './AskMuse.jsx'
import Declutter, { declutterLeft } from './Declutter.jsx'
import Inventory from './Inventory.jsx'
import MoreParts from './MoreParts.jsx'
import ScanGuide from './ScanGuide.jsx'
import ItemDetail from './ItemDetail.jsx'
import { deleteChat, deleteSpace, loadSpaces, saveSpace } from './savedSpaces.js'
import SpacePicker from './SpacePicker.jsx'
import SpacesPage from './SpacesPage.jsx'
import { getOwnerKey, setOwnerKey, shareSpace, sharePayload, unshareSpace } from './sharing.js'
import { makePictures, needsPictures } from './crop.js'
import { categoryOf, sortItems } from './spaceItems.js'
import { askMotionPermission } from './sweep.js'
import Welcome from './Welcome.jsx'

// The scanner loads separately, so the welcome screen's loading is real.
const loadScanner = () => import('./Camera.jsx')
const Camera = lazy(loadScanner)

export default function App() {
  const [screen, setScreen] = useState(null) // null while loading, then home → pick → scan → space ⇄ spaces
  const [spaces, setSpaces] = useState([])
  const [openId, setOpenId] = useState(null)
  const [openItemId, setOpenItemId] = useState(null)
  const [focusItem, setFocusItem] = useState(null) // the item to scroll to after saving it
  const [leftToDeclutter, setLeftToDeclutter] = useState(null)
  const [showGuide, setShowGuide] = useState(false)
  const [parts, setParts] = useState(1) // parts of the open Space scanned in this go, for the "Is there more?" screen
  const [pending, setPending] = useState(null) // the Space about to be scanned: { name, id if rescanning }
  const [failed, setFailed] = useState({}) // id → why recognition stopped
  const [progress, setProgress] = useState(null)
  const [runsDone, setRunsDone] = useState(0)
  const running = useRef(null) // only one Space is recognized at a time, since each run costs money
  const picturing = useRef(null) // pictures are made for one Space at a time, to keep memory low
  const synced = useRef({}) // id → the item list the server last got, so unchanged Spaces aren't sent again
  const [shareErrors, setShareErrors] = useState({}) // id → why keeping a shared Space up to date failed
  const fileInput = useRef(null)

  const open = spaces.find(s => s.id === openId)
  const openItem = open?.result?.items.find(i => i.id === openItemId)
  const processing = spaces.some(s => (!s.result || s.addFrames) && !failed[s.id])

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
  // This also restarts a run the phone interrupted by going to sleep. Photos added to a finished
  // Space are recognized on their own, then merged in.
  useEffect(() => {
    const next = spaces.find(s => (!s.result || s.addFrames) && !failed[s.id])
    if (!next || running.current) return
    running.current = next.id
    setProgress(null)
    const work = next.result ? addToSpace(next) : buildInventory(next.frames, next.spaceName, setProgress)
      .then(result => change(next.id, s => ({ ...s, result })))
    work
      .catch(err => setFailed(f => ({ ...f, [next.id]: err.message })))
      // A run's own update lands while it still counts as running, so look for queued work again after.
      .finally(() => { running.current = null; setRunsDone(n => n + 1) })
  }, [spaces, failed, runsDone])

  /**
   * Recognizes added photos, makes the new items' pictures, and asks which may already be listed.
   * New items keep their own ids and point at their own photos, after the Space's existing ones.
   */
  async function addToSpace(space) {
    const added = await buildInventory(space.addFrames, space.spaceName, setProgress)
    const firstPhoto = space.frames.length
    const firstId = Math.max(-1, ...space.result.items.map(i => i.id)) + 1
    const items = added.items.map(i => ({
      ...i,
      id: i.id + firstId,
      photos: (i.photos ?? []).map(p => p + firstPhoto),
      view: i.view && { ...i.view, photo: i.view.photo + firstPhoto },
      addedAt: new Date().toISOString(),
    }))
    const frames = [...space.frames, ...space.addFrames]
    const { pictures } = await makePictures({ frames, result: { items } })
    const withPictures = items.map(i => ({ ...i, picture: pictures[i.id] ?? '' }))
    const { inSpace, nearby } = sortItems(space)
    const describe = (prefix, i) => ({ ref: `${prefix}${i.id}`, name: i.name, description: i.description, category: i.category, picture: i.picture || '' })
    // If the check fails, the new items are simply added: a possible repeat is better than a lost item.
    const { repeats } = await findRepeats(space.spaceName, [...inSpace, ...nearby].map(i => describe('e', i)), withPictures.map(i => describe('n', i)))
      .catch(() => ({ repeats: {} }))
    change(space.id, s => {
      if (s.savedAt !== space.savedAt) return s
      const { addFrames: _, ...rest } = s
      return {
        ...rest,
        frames,
        result: {
          ...s.result,
          items: [...s.result.items, ...withPictures.map(i => {
            const same = repeats[`n${i.id}`]
            return same ? { ...i, possibleRepeatOf: Number(same.slice(1)) } : i
          })],
        },
      }
    })
  }

  // Photos for a part of the Space the first scan couldn't see, waiting to be recognized.
  function addPhotos(id, frames) {
    if (!frames.length) return
    setFailed(({ [id]: _, ...rest }) => rest)
    change(id, s => ({ ...s, addFrames: [...(s.addFrames ?? []), ...frames] }))
  }

  useEffect(() => {
    if (screen === 'spaces') declutterLeft().then(setLeftToDeclutter)
  }, [screen])

  // Each item's picture is made once, after recognition, and saved. Older Spaces get theirs here too.
  useEffect(() => {
    const next = spaces.find(needsPictures)
    if (!next || picturing.current) return
    picturing.current = next.id
    makePictures(next).then(({ pictures, cover }) => change(next.id, s => (s.savedAt !== next.savedAt ? s : {
      ...s,
      cover: cover ?? '',
      result: { ...s.result, items: s.result.items.map(i => ({ ...i, picture: pictures[i.id] ?? i.picture ?? '' })) },
    }))).finally(() => { picturing.current = null })
  }, [spaces])

  // A shared Space follows its changes: removed items, added nearby ones, a finished rescan.
  // Waits a moment so quick edits go as one update.
  useEffect(() => {
    const key = getOwnerKey()
    const stale = spaces.filter(s => s.shared && s.result && synced.current[s.id] !== JSON.stringify(sharePayload(s)))
    if (!key || !stale.length) return
    const timer = setTimeout(() => stale.forEach(space => {
      const sent = JSON.stringify(sharePayload(space))
      shareSpace(space, key)
        .then(() => { synced.current[space.id] = sent; setShareErrors(({ [space.id]: _, ...rest }) => rest) })
        .catch(err => setShareErrors(e => ({ ...e, [space.id]: err.message })))
    }), 800)
    return () => clearTimeout(timer)
  }, [spaces])

  // Turning sharing on sends the list right away, so a wrong key or a server problem shows up here.
  async function setSharing(space, on, typedKey) {
    const key = typedKey ?? getOwnerKey()
    if (on) {
      await shareSpace(space, key)
      synced.current[space.id] = JSON.stringify(sharePayload(space))
    } else {
      await unshareSpace(space.id, key)
      delete synced.current[space.id]
    }
    if (typedKey) setOwnerKey(typedKey)
    setShareErrors(({ [space.id]: _, ...rest }) => rest)
    change(space.id, s => ({ ...s, shared: on }))
  }

  function onPhotoFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) shrinkPhoto(file).then(small => onScan({ frames: [small] }))
  }

  // Save before recognition starts, so a phone going to sleep can't lose the photos.
  function onScan({ frames }) {
    if (pending.adding) {
      addPhotos(pending.id, frames)
      setOpenId(pending.id)
      setParts(p => p + 1)
      setScreen('more')
      return
    }
    const previous = spaces.find(s => s.id === pending.id)
    const fresh = {
      id: previous?.id ?? crypto.randomUUID(),
      spaceName: pending.name,
      frames,
      result: null,
      itemChoices: {},
      shared: previous?.shared ?? false, // a rescan of a shared Space updates what Muse sees once it's ready
      createdAt: previous?.createdAt ?? Date.now(),
      savedAt: Date.now(),
    }
    saveSpace(fresh)
    if (previous) deleteChat(previous.id) // it was about the items this scan replaces
    setSpaces(current => (previous ? current.map(s => (s.id === fresh.id ? fresh : s)) : [...current, fresh]))
    setFailed(({ [fresh.id]: _, ...rest }) => rest)
    setOpenId(fresh.id)
    setParts(1)
    setScreen('more')
  }

  // Photos can only be taken after motion access, which iPhones only grant from a tap like this one.
  // The guide shows before every scan or rescan, but not for the extra parts of a Space.
  function startScan(name, id, adding = false) {
    askMotionPermission()
    setPending({ name, id, adding, from: screen })
    setShowGuide(!adding)
    setScreen('scan')
  }

  function onPick(name) {
    const existing = spaces.find(s => s.spaceName.toLowerCase() === name.toLowerCase())
    startScan(existing?.spaceName ?? name, existing?.id)
  }

  // Decisions and sale details live on the item, with the time they last changed.
  function updateItem(spaceId, itemId, patch) {
    change(spaceId, s => ({
      ...s,
      result: { ...s.result, items: s.result.items.map(i => (i.id === itemId ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i)) },
    }))
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

  // A shared Space comes off the server first, so deleting it here can't leave its items with Muse.
  async function onDelete() {
    if (open.shared) await unshareSpace(open.id, getOwnerKey())
    await deleteSpace(open.id)
    deleteChat(open.id)
    const left = spaces.filter(s => s.id !== open.id)
    setSpaces(left)
    setOpenId(null)
    setScreen(left.length ? 'spaces' : 'home')
  }

  const leaveScanner = () => {
    if (pending?.adding) setScreen(pending.from === 'more' ? 'more' : 'space')
    else if (pending?.id) setScreen('space')
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
          onDeclutter={() => setScreen('declutter')}
          declutterLeft={leftToDeclutter}
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
            onTips={() => setShowGuide(true)}
          />
          <ScanGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
        </Suspense>
      )}

      {screen === 'more' && open && (
        <MoreParts
          space={open}
          parts={parts}
          onScanAnother={() => startScan(open.spaceName, open.id, true)}
          onAddPhotos={frames => { if (frames.length) { addPhotos(open.id, frames); setParts(p => p + 1) } }}
          onDone={() => setScreen('space')}
        />
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
          onScanMore={() => startScan(open.spaceName, open.id, true)}
          onAddPhotos={frames => addPhotos(open.id, frames)}
          onDiscardAdded={() => {
            setFailed(({ [open.id]: _, ...rest }) => rest)
            change(open.id, ({ addFrames: _, ...s }) => s)
          }}
          onConfirmRepeat={(item, same) => {
            if (same) change(open.id, s => ({ ...s, result: { ...s.result, items: s.result.items.filter(i => i.id !== item.id) } }))
            else updateItem(open.id, item.id, { possibleRepeatOf: null })
          }}
          onBack={() => setScreen('spaces')}
          onAsk={() => setScreen('ask-space')}
          onOpenItem={id => { setOpenItemId(id); setScreen('item') }}
          focusItem={focusItem}
          onFocused={() => setFocusItem(null)}
          shareError={shareErrors[open.id]}
          hasOwnerKey={Boolean(getOwnerKey())}
          onShare={(on, typedKey) => setSharing(open, on, typedKey)}
        />
      )}

      {screen === 'item' && open && openItem && (
        <ItemDetail
          key={openItem.id}
          space={open}
          item={openItem}
          onChange={patch => updateItem(open.id, openItem.id, patch)}
          onBack={() => setScreen('space')}
          onSave={() => {
            // Back to the item in its list, with its sections open so the change is in view.
            change(open.id, s => ({ ...s, openSections: { ...s.openSections, inventory: true, [categoryOf(openItem)]: true } }))
            setFocusItem(openItem.id)
            setScreen('space')
          }}
        />
      )}

      {screen === 'declutter' && <Declutter spaces={spaces} onUpdateItem={updateItem} onExit={() => setScreen('spaces')} />}

      {screen === 'ask-all' && <AskMuse spaces={spaces} space={null} onBack={() => setScreen('spaces')} />}
      {screen === 'ask-space' && open && <AskMuse key={open.id} spaces={spaces} space={open} onBack={() => setScreen('space')} />}
    </>
  )
}
