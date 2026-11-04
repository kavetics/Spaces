import { useEffect, useRef, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { askMuse } from './api.js'
import { deleteChat, loadChat, saveChat } from './savedSpaces.js'
import { buildGraph, findCited } from './spaceGraph.js'
import ScanPulse from './ScanPulse.jsx'
import { scannedAt } from './spaceItems.js'
import { isoDay } from './tasks.js'
import './AskMuse.css'
import './Inventory.css'

const STARTERS = {
  one: ["What's most valuable here?", 'What could I sell?', 'What could I donate?'],
  all: ['Do I own any duplicates?', 'What could I sell before moving?', "What's due this week?"],
}

// Turns "Your [[i3]] is here" into text and citations, and fixes each citation to its item for later.
function toParts(answer, places) {
  return answer.split(/(\[\[[^\]]*\]\])/).flatMap(part => {
    const ref = part.match(/^\[\[(.*)\]\]$/)?.[1]
    if (!ref) return part ? [{ text: part }] : []
    return places[ref] ? [{ cite: places[ref] }] : []
  })
}

/** Shows the photo an item was seen in, with the item outlined. */
function Citation({ cited, onClose }) {
  const { space, item } = cited
  const [photo, setPhoto] = useState(null)
  const frame = item.view ? space.frames[item.view.photo] : null
  useEffect(() => {
    if (!frame) return
    const url = URL.createObjectURL(frame)
    setPhoto(url)
    return () => URL.revokeObjectURL(url)
  }, [frame])
  const box = item.view?.box
  return (
    <Dialog isOpen onOpenChange={onClose} width={480}>
      <Layout
        header={<DialogHeader title={item.name} subtitle={`${space.spaceName} · Scanned ${scannedAt(space.savedAt)}`} onOpenChange={onClose} />}
        content={
          <LayoutContent>
            {!photo && item.picture && <img className="item-photo" src={item.picture} alt={item.name} />}
            {photo && (
              <figure className="citation-photo">
                <img src={photo} alt={`Scan photo showing ${item.name}`} onError={() => setPhoto(null)} />
                {box && (
                  <span
                    className="citation-box"
                    style={{ left: `${box.x1 * 100}%`, top: `${box.y1 * 100}%`, width: `${(box.x2 - box.x1) * 100}%`, height: `${(box.y2 - box.y1) * 100}%` }}
                  />
                )}
              </figure>
            )}
          </LayoutContent>
        }
      />
    </Dialog>
  )
}

function Answer({ parts, spaces, onCite }) {
  return (
    <Text as="p">
      {parts.map((part, i) => {
        if (part.text) return <span key={i}>{part.text}</span>
        const cited = findCited(spaces, part.cite)
        if (!cited) return <span key={i} title="No longer in this Space">{part.cite.name}</span>
        return <button key={i} type="button" className="citation" onClick={() => onCite(cited)}>{cited.item.name}</button>
      })}
    </Text>
  )
}

/** Muse's offer to draft a listing: the item, and a button that marks it Sell and opens the draft. */
function ListingOffer({ action, spaces, onDraft }) {
  const cited = findCited(spaces, action.cite)
  if (!cited) return null
  const { space, item } = cited
  const selling = item.status === 'sell'
  return (
    <HStack gap={3} vAlign="center" padding={3} className="ask-muse-offer">
      {item.picture ? <img className="inventory-crop" src={item.picture} alt="" /> : <span className="inventory-crop" />}
      <VStack gap={1} className="ask-muse-offer-text">
        <Text weight="semibold">{item.name}</Text>
        <Text type="supporting">{space.spaceName}{item.listingDraft ? ' · Listing drafted' : ''}</Text>
        <Button
          label={item.listingDraft ? 'Open listing' : selling ? 'Draft a listing' : 'Sell and draft a listing'}
          variant="primary"
          onClick={() => onDraft(space.id, item.id)}
        />
      </VStack>
    </HStack>
  )
}

const names = list => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] ?? '')

/**
 * Chat about one Space, or, when space is null, every Space shared with Muse. Only ever knows about its own
 * scope; notShared are listed so a person can go and share one.
 */
/** opening: from the dock on My home, { ask } to send a starter question at once, or { focus } to start typing. */
export default function AskMuse({ spaces, notShared = [], people = [], space, onBack, onOpenSpace, onDraftListing, opening }) {
  const scope = space ? space.spaceName : names(spaces.map(s => s.spaceName))
  const heading = space || spaces.length <= 2 ? scope || 'No Spaces shared' : `${spaces.length} Spaces`
  const nothingShared = !space && spaces.length === 0
  const chatKey = space ? space.id : 'all'
  const inScope = space ? [space] : spaces
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState(null)
  const [cited, setCited] = useState(null)
  const end = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const opened = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadChat(chatKey).then(saved => { if (cancelled) return; if (saved) setMessages(saved); setLoaded(true) })
    return () => { cancelled = true }
  }, [chatKey])

  // A starter tapped on the dock is asked once the saved chat is in, so it follows what's already there.
  useEffect(() => {
    if (!loaded || opened.current || nothingShared) return
    opened.current = true
    if (opening?.ask) send(opening.ask)
    else if (opening?.focus) document.querySelector('.ask-muse-input input')?.focus()
    // Runs once, when the chat has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages, waiting])

  async function send(question) {
    const text = question.trim()
    if (!text || waiting) return
    const asked = [...messages, { role: 'user', text }]
    setMessages(asked)
    setDraft('')
    setError(null)
    setWaiting(true)
    saveChat(chatKey, asked)
    try {
      const { nodes, places } = buildGraph(inScope, people)
      // Past answers go back as plain text, with citations written as the item's name.
      const history = asked.map(m => ({ role: m.role, text: m.text ?? m.parts.map(p => p.text ?? p.cite.name).join('') }))
      const { answer, action } = await askMuse({ scope, spaces: nodes, messages: history, today: isoDay() })
      const offer = action && places[action.ref] ? { type: action.type, cite: places[action.ref] } : null
      const done = [...asked, { role: 'assistant', parts: toParts(answer, places), ...(offer && { action: offer }) }]
      setMessages(done)
      saveChat(chatKey, done)
    } catch (err) {
      // Nothing is lost: the question goes back in the box, ready to send again.
      setMessages(messages)
      saveChat(chatKey, messages)
      setDraft(text)
      setError(err.message)
    } finally {
      setWaiting(false)
    }
  }

  function clear() {
    setMessages([])
    deleteChat(chatKey)
  }

  return (
    <section className="ask-muse" aria-label={`Ask Muse about ${heading}`}>
      <HStack gap={3} vAlign="center" padding={3} className="ask-muse-header">
        <IconButton label="Back" icon={<Icon icon="chevronLeft" />} onClick={onBack} />
        <VStack className="ask-muse-title">
          <Heading level={1}>Ask Muse</Heading>
          <Text type="supporting">{heading}</Text>
        </VStack>
        {messages.length > 0 && <Button label="Clear" variant="ghost" onClick={clear} />}
      </HStack>

      <VStack gap={3} padding={4} className="ask-muse-messages" aria-live="polite">
        {nothingShared && (
          <VStack gap={2} padding={4} className="ask-muse-offer">
            <Heading level={2}>Share a Space to ask about it</Heading>
            <Text as="p" color="secondary">Muse only sees the Spaces you share. Open one and turn on Share with Muse.</Text>
            {notShared.map(s => <Button key={s.id} label={s.spaceName} width="100%" onClick={() => onOpenSpace(s.id)} />)}
          </VStack>
        )}
        {messages.length === 0 && !nothingShared && (
          <VStack gap={2}>
            <Text as="p" color="secondary">Muse answers from what you've scanned and your tasks, and shows where it saw each item.</Text>
            {STARTERS[space ? 'one' : 'all'].map(s => <Button key={s} label={s} onClick={() => send(s)} />)}
          </VStack>
        )}
        {messages.map((m, i) => (m.role === 'user'
          ? <Text key={i} as="p" className="ask-muse-question">{m.text}</Text>
          : (
            <VStack key={i} gap={2}>
              <Answer parts={m.parts} spaces={spaces} onCite={setCited} />
              {m.action && <ListingOffer action={m.action} spaces={spaces} onDraft={onDraftListing} />}
            </VStack>
          )))}
        {waiting && (
          <HStack gap={2} vAlign="center" role="status">
            <ScanPulse label="Thinking" small />
            <Text color="secondary">Thinking…</Text>
          </HStack>
        )}
        {error && <Text as="p" role="alert">{error} Your question is back in the box, so you can try again.</Text>}
        <span ref={end} />
      </VStack>

      {/* The same gold-edged box as the dock on My home, so tapping the dock feels like this box coming to life. */}
      <form className="ask-muse-input" onSubmit={e => { e.preventDefault(); send(draft) }}>
        <HStack gap={1} vAlign="center" className="muse-box">
          <TextInput label="Your question" isLabelHidden placeholder={nothingShared ? 'Share a Space first' : `Ask Muse about ${space ? space.spaceName : 'your home'}`} isDisabled={nothingShared} value={draft} onChange={setDraft} containerClassName="grow" controlClassName="muse-box-control" />
          <Button label="Send" type="submit" variant="primary" icon={<Icon icon="arrowUp" size="sm" />} isIconOnly className="muse-send" isDisabled={nothingShared || !draft.trim() || waiting} />
        </HStack>
      </form>

      {cited && <Citation cited={cited} onClose={() => setCited(null)} />}
    </section>
  )
}
