import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { buildInventory, deleteVoteLink, findRepeats, getVoteResults, shrinkPhoto } from './api.js'
import AskMuse from './AskMuse.jsx'
import Declutter, { declutterLeft, forgetDeclutter } from './Declutter.jsx'
import Inventory from './Inventory.jsx'
import MoreParts from './MoreParts.jsx'
import ScanGuide from './ScanGuide.jsx'
import ItemDetail from './ItemDetail.jsx'
import People from './People.jsx'
import { deleteChat, deleteSpace, loadPeople, loadSpaces, savePeople, saveSpace } from './savedSpaces.js'
import SpacePicker from './SpacePicker.jsx'
import SpacesPage from './SpacesPage.jsx'
import VoteSetup, { VoteStatus } from './VoteSetup.jsx'
import { tally, tallyLine } from './votes.js'
import { getOwnerKey, setOwnerKey, shareSpace, sharePayload, unshareSpace } from './sharing.js'
import { makePictures, needsPictures } from './crop.js'
import { categoryOf, sortItems } from './spaceItems.js'
import { askMotionPermission } from './sweep.js'
import Welcome from './Welcome.jsx'

// The scanner loads separately, so the welcome screen's loading is real.
const loadScanner = () => import('./Camera.jsx')
const Camera = lazy(loadScanner)

/** A new scan's items, then the hand-added ones it kept, numbered after them so ids stay unique. */
function withHandItems(result, handItems) {
  const firstId = Math.max(-1, ...result.items.map(i => i.id)) + 1
  return { ...result, items: [...result.items, ...handItems.map((i, n) => ({ ...i, id: firstId + n }))] }
}

export default function App() {
  const [screen, setScreen] = useState(null) // null while loading, then home → pick → scan → space ⇄ spaces
  const [spaces, setSpaces] = useState([])
  const [people, setPeople] = useState([]) // the household, added by hand or from contacts
  const [voteSetup, setVoteSetup] = useState(null) // making a vote link: { preselect: item ids or null for all, from: screen }
  const [voteResults, setVoteResults] = useState({}) // Space id → its family votes, as the server last sent them
  const [openId, setOpenId] = useState(null)
  const [openItemId, setOpenItemId] = useState(null)
  const [focusItem, setFocusItem] = useState(null) // the item to scroll to after saving it
  const [itemFrom, setItemFrom] = useState(null) // an item opened from Ask Muse goes back there, with its listing drafting
  const [leftToDeclutter, setLeftToDeclutter] = useState({}) // Space id → items left in its saved Declutter session
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
    Promise.all([loadSpaces(), loadPeople()]).then(([saved, household]) => {
      if (cancelled) return
      setSpaces(saved)
      setPeople(household)
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
      .then(result => change(next.id, ({ handItems = [], ...s }) => ({ ...s, result: withHandItems(result, handItems) })))
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
    if (screen === 'space' && openId != null) declutterLeft(openId).then(left => setLeftToDeclutter(l => ({ ...l, [openId]: left })))
  }, [screen, openId])

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
      // Items added by hand weren't scanned, so a rescan keeps them. They join the new list once it's ready.
      handItems: [...(previous?.handItems ?? []), ...(previous?.result?.items.filter(i => i.addedByHand) ?? [])],
      itemChoices: {},
      shared: previous?.shared ?? false, // a rescan of a shared Space updates what Muse sees once it's ready
      createdAt: previous?.createdAt ?? Date.now(),
      savedAt: Date.now(),
    }
    saveSpace(fresh)
    if (previous) {
      // Both were about the items this scan replaces.
      deleteChat(previous.id)
      forgetDeclutter(previous.id)
      if (previous.voteLink) deleteVoteLink(previous.voteLink.id, previous.voteLink.ownerToken).catch(() => {}) // it asked about the old items
    }
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
  // A Space's family votes, fetched whenever its page, an item or Declutter opens.
  const voteLinkId = open?.voteLink?.id
  useEffect(() => {
    const link = open?.voteLink
    if (!link || !['space', 'item', 'declutter'].includes(screen)) return
    let cancelled = false
    getVoteResults(link.id, link.ownerToken).then(
      results => { if (!cancelled) setVoteResults(v => ({ ...v, [open.id]: results })) },
      err => {
        // Ended or deleted on the server: forget it here too. Other errors leave the last votes showing.
        if (!cancelled && [404, 410].includes(err.status)) change(open.id, ({ voteLink: _, ...s }) => s)
      },
    )
    return () => { cancelled = true }
    // Refetch per screen and per link, not on every change to the Space.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, open?.id, voteLinkId])

  const askFamily = (preselect = null, from = 'space') => { setVoteSetup({ preselect, from }); setScreen('vote-setup') }

  async function stopVote(space) {
    try {
      await deleteVoteLink(space.voteLink.id, space.voteLink.ownerToken)
    } catch (err) {
      if (err.status !== 404 && err.status !== 410) throw err
    }
    change(space.id, ({ voteLink: _, ...s }) => s)
    setVoteResults(({ [space.id]: _, ...rest }) => rest)
  }

  const familyVotes = (space, itemId) => tallyLine(tally(space, voteResults[space.id], itemId))

  function updateItem(spaceId, itemId, patch) {
    change(spaceId, s => ({
      ...s,
      result: { ...s.result, items: s.result.items.map(i => (i.id === itemId ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i)) },
    }))
  }

  // An item the scan missed. It has no scan photo, only the person's own photo if they added one.
  function addItem(spaceId, { name, category, quantity, picture }) {
    const id = Math.max(-1, ...spaces.find(s => s.id === spaceId).result.items.map(i => i.id)) + 1
    change(spaceId, s => {
      const item = { id, name, category, quantity, description: '', photos: [], needsReview: false, inSpace: true, area: '', picture: picture ?? '', addedByHand: true, addedAt: new Date().toISOString() }
      return { ...s, openSections: { ...s.openSections, inventory: true, [category]: true }, result: { ...s.result, items: [...s.result.items, item] } }
    })
    setFocusItem(id)
  }

  // From Muse's offer in the chat: the person chose to sell it, so mark it Sell and open its listing.
  function draftFromChat(spaceId, itemId) {
    const item = spaces.find(s => s.id === spaceId)?.result?.items.find(i => i.id === itemId)
    if (!item) return
    if (item.status !== 'sell') updateItem(spaceId, itemId, { status: 'sell' })
    setItemFrom(screen)
    setOpenId(spaceId)
    setOpenItemId(itemId)
    setScreen('item')
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
    forgetDeclutter(open.id)
    if (open.voteLink) deleteVoteLink(open.voteLink.id, open.voteLink.ownerToken).catch(() => {})
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
          people={people}
          onPeople={() => setScreen('people')}
        />
      )}

      {screen === 'people' && (
        <People
          people={people}
          spaces={spaces.filter(s => s.result)}
          onChange={next => { setPeople(next); savePeople(next) }}
          onBack={() => setScreen('spaces')}
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
          onAddItem={fields => addItem(open.id, fields)}
          onBack={() => setScreen('spaces')}
          onDeclutter={() => setScreen('declutter')}
          declutterLeft={leftToDeclutter[open.id]}
          usedBy={people.filter(p => p.spaceIds?.includes(open.id)).map(p => p.name)}
          onAskFamily={() => askFamily()}
          voteStatus={open.voteLink && (
            <VoteStatus space={open} people={people} results={voteResults[open.id]} onNewVote={() => askFamily()} onStop={() => stopVote(open)} />
          )}
          onOpenItem={id => { setOpenItemId(id); setItemFrom(null); setScreen('item') }}
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
          familyVotes={familyVotes(open, openItem.id)}
          onAskFamily={() => askFamily([openItem.id], 'item')}
          backLabel={itemFrom ? 'Ask Muse' : undefined}
          autoDraft={Boolean(itemFrom)}
          onBack={() => setScreen(itemFrom ?? 'space')}
          onSave={() => {
            if (itemFrom) { setScreen(itemFrom); return }
            // Back to the item in its list, with its sections open so the change is in view.
            change(open.id, s => ({ ...s, openSections: { ...s.openSections, inventory: true, [categoryOf(openItem)]: true } }))
            setFocusItem(openItem.id)
            setScreen('space')
          }}
        />
      )}

      {screen === 'declutter' && open && (
        <Declutter
          key={open.id}
          space={open}
          familyVotes={itemId => familyVotes(open, itemId)}
          onAskFamily={() => askFamily(null, 'space')}
          onUpdateItem={(itemId, patch) => updateItem(open.id, itemId, patch)}
          onExit={() => setScreen('space')}
        />
      )}

      {screen === 'vote-setup' && open && (
        <VoteSetup
          key={open.id}
          space={open}
          people={people}
          preselect={voteSetup?.preselect}
          onCreated={voteLink => {
            change(open.id, s => ({ ...s, voteLink }))
            setVoteResults(v => ({ ...v, [open.id]: { votes: [] } }))
          }}
          onBack={() => setScreen(voteSetup?.from ?? 'space')}
          onPeople={() => setScreen('people')}
        />
      )}

      {screen === 'ask-all' && <AskMuse spaces={spaces} space={null} onBack={() => setScreen('spaces')} onDraftListing={draftFromChat} />}    </>
  )
}
