import { useEffect, useRef, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { askMuse } from './api.js'
import { deleteChat, loadChat, saveChat } from './savedSpaces.js'
import { buildGraph, findCited } from './spaceGraph.js'
import { scannedAt } from './spaceItems.js'
import './AskMuse.css'
import './Inventory.css'

const STARTERS = {
  one: ["What's most valuable here?", 'What could I sell?', 'What could I donate?'],
  all: ['Do I own any duplicates?', 'What could I sell before moving?', 'Which Space has the most stuff?'],
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
        if (!cited) return <span key={i} title="No longer in this inventory">{part.cite.name}</span>
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
          size="sm"
          onClick={() => onDraft(space.id, item.id)}
        />
      </VStack>
    </HStack>
  )
}

/** Chat about one Space, or all of them when space is null. Only ever knows about its own scope. */
export default function AskMuse({ spaces, space, onBack, onDraftListing }) {
  const scope = space ? space.spaceName : 'All Spaces'
  const chatKey = space ? space.id : 'all'
  const inScope = space ? [space] : spaces
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState(null)
  const [cited, setCited] = useState(null)
  const end = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadChat(chatKey).then(saved => { if (!cancelled && saved) setMessages(saved) })
    return () => { cancelled = true }
  }, [chatKey])

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
      const { nodes, places } = buildGraph(inScope)
      // Past answers go back as plain text, with citations written as the item's name.
      const history = asked.map(m => ({ role: m.role, text: m.text ?? m.parts.map(p => p.text ?? p.cite.name).join('') }))
      const { answer, action } = await askMuse({ scope, spaces: nodes, messages: history })
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
    <section className="ask-muse" aria-label={`Ask Muse about ${scope}`}>
      <HStack gap={3} vAlign="center" padding={3} className="ask-muse-header">
        <IconButton label="Back" icon={<Icon icon="chevronLeft" />} onClick={onBack} />
        <VStack className="ask-muse-title">
          <Heading level={1}>Ask Muse</Heading>
          <Text type="supporting">{scope}</Text>
        </VStack>
        {messages.length > 0 && <Button label="Clear" variant="ghost" size="sm" onClick={clear} />}
      </HStack>

      <VStack gap={3} padding={4} className="ask-muse-messages" aria-live="polite">
        {messages.length === 0 && (
          <VStack gap={2}>
            <Text as="p" color="secondary">Muse answers from what you've scanned, and shows where it saw each item.</Text>
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
        {waiting && <Spinner size="md" label="Thinking…" />}
        {error && <Text as="p" role="alert">{error} Your question is back in the box, so you can try again.</Text>}
        <span ref={end} />
      </VStack>

      <form className="ask-muse-input" onSubmit={e => { e.preventDefault(); send(draft) }}>
        <TextInput label="Your question" isLabelHidden placeholder="Ask about your things" value={draft} onChange={setDraft} />
        <Button label="Send" type="submit" variant="primary" isDisabled={!draft.trim() || waiting} />
      </form>

      {cited && <Citation cited={cited} onClose={() => setCited(null)} />}
    </section>
  )
}
