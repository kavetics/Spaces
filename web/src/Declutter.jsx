import { useEffect, useRef, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { List, ListItem } from '@astryxdesign/core/List'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { DECISIONS, decisionLabel, decisionOf } from './itemFields.js'
import { deleteChat, loadChat, saveChat } from './savedSpaces.js'
import SellForm from './SellForm.jsx'
import { CATEGORIES, categoryOf, countLabel, sortItems } from './spaceItems.js'
import './Inventory.css'

const categoryRank = item => CATEGORIES.findIndex(([id]) => id === categoryOf(item))
const categoryName = item => CATEGORIES.find(([id]) => id === categoryOf(item))?.[1]

/** Every item in the Space, grouped by category. */
const buildStack = space => [...sortItems(space).inSpace]
  .sort((a, b) => categoryRank(a) - categoryRank(b))
  .map(item => item.id)

function Resume({ space, saved, onResume, onRestart, onCancel }) {
  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack><IconButton label={space.spaceName} icon={<Icon icon="chevronLeft" />} onClick={onCancel} /></HStack>
      <VStack gap={2} className="declutter-resume">
        <Heading level={1}>Pick up where you left off</Heading>
        <Text as="p" color="secondary">{space.spaceName}: you stopped at {saved.place + 1} of {saved.stack.length} · {saved.stack.length - saved.place} left.</Text>
        <ProgressBar label="Items gone through" isLabelHidden value={saved.place} max={saved.stack.length} />
        <Button label="Resume" variant="primary" size="lg" onClick={onResume} />
      </VStack>
      <VStack gap={1}>
        <Button label="Start over" size="lg" onClick={onRestart} />
        <Text as="p" type="supporting" color="secondary" justify="center">Your decisions so far are kept. Starting over just goes through every item again.</Text>
      </VStack>
    </VStack>
  )
}

function Card({ space, item, place, total, canUndo, familyVotes, onDecide, onSellDone, onUndo, onSkip, onChange, onStop }) {
  const top = useRef(null)
  const current = decisionOf(item.status)
  useEffect(() => {
    top.current?.closest('.inventory')?.scrollTo?.(0, 0)
  }, [item.id])

  return (
    <VStack gap={4} padding={4} className="inventory">
      <HStack gap={3} vAlign="center" ref={top}>
        <IconButton label="Stop decluttering" icon={<Icon icon="close" />} onClick={onStop} />
        <VStack gap={1} className="declutter-progress">
          <Text type="label">{place} of {total} · {total - place + 1} left</Text>
          <ProgressBar label="Items gone through" isLabelHidden value={place - 1} max={total} />
        </VStack>
      </HStack>
      <Text color="secondary">{space.spaceName} · {categoryName(item)}</Text>
      {item.picture ? <img className="item-photo" src={item.picture} alt={item.name} /> : <span className="item-photo declutter-blank" />}
      <VStack gap={1}>
        <Heading level={1}>{item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name}</Heading>
        <Text as="p" color="secondary">{item.needsReview ? `Not sure. ${item.description}` : item.description}</Text>
        {current && <Text as="p" type="label">Currently: {decisionLabel(current)}</Text>}
        {familyVotes && <Text as="p" type="label">Family votes: {familyVotes}</Text>}
      </VStack>
      <HStack gap={2} className="declutter-choices">
        {DECISIONS.map(([id, name]) => (
          <Button key={id} label={name} size="lg" variant={current === id ? 'primary' : 'secondary'} onClick={() => onDecide(id)} />
        ))}
      </HStack>
      {current === 'sell' && (
        <VStack gap={4}>
          <SellForm item={item} onChange={onChange} />
          <Button label="Next item" variant="primary" size="lg" onClick={onSellDone} />
          <Text as="p" color="secondary" justify="center">You can add photos and details later from the item.</Text>
        </VStack>
      )}
      <HStack gap={2} hAlign="between">
        <Button label="Undo" variant="ghost" isDisabled={!canUndo} onClick={onUndo} />
        <Button label="Skip" variant="ghost" onClick={onSkip} />
      </HStack>
    </VStack>
  )
}

function money(item) {
  const asking = item.details?.askingPrice
  const estimate = item.details?.estimatedValue?.amount
  if (asking) return `$${asking}`
  if (estimate) return `about $${estimate}, AI estimate`
  return null
}

function Summary({ space, stack, onAgain, onDone, onAskFamily, onSelling }) {
  const items = stack.map(id => space.result.items.find(i => i.id === id)).filter(Boolean)
  const selling = items.filter(item => decisionOf(item.status) === 'sell')
  const lettingGo = items.filter(item => decisionOf(item.status) === 'donate')
  const row = (item, extra) => <ListItem key={item.id} label={item.name} description={extra || undefined} />
  return (
    <VStack gap={5} padding={4} className="inventory">
      <VStack gap={1}>
        <Heading level={1}>{space.spaceName} is done</Heading>
        <Text as="p" color="secondary">You went through {countLabel(items.length)}: {selling.length} to sell, {lettingGo.length} to let go.</Text>
      </VStack>
      <VStack gap={2}>
        <Heading level={2}>To sell ({selling.length})</Heading>
        {selling.length
          ? <List hasDividers edge="flush">{selling.map(item => row(item, [money(item), item.salePhotos?.length ? null : 'needs photos'].filter(Boolean).join(' · ')))}</List>
          : <Text as="p" color="secondary">Nothing to sell.</Text>}
      </VStack>
      <VStack gap={2}>
        <Heading level={2}>To let go ({lettingGo.length})</Heading>
        {lettingGo.length
          ? <List hasDividers edge="flush">{lettingGo.map(item => row(item))}</List>
          : <Text as="p" color="secondary">Nothing to let go.</Text>}
      </VStack>
      <Button label="Done" variant="primary" size="lg" onClick={onDone} />
      <Button label="See everything for sale & letting go" onClick={onSelling} />
      <Button label="Ask family to vote" onClick={onAskFamily} />
      <Button label="Go again" variant="ghost" onClick={onAgain} />
    </VStack>
  )
}

/**
 * Decluttering one Space, one item at a time: decide on each item with one tap, then see what to
 * sell and what to let go. Every decision is saved as it's made, so stopping partway loses nothing.
 * Each Space keeps its own place.
 */
const sessionKey = spaceId => `declutter:${spaceId}`
const unfinished = s => (s?.stack?.length && s.place < s.stack.length ? s : null)

/** How many items are left in a Space's saved Declutter session, or null when there isn't one. */
export const declutterLeft = spaceId => loadChat(sessionKey(spaceId)).then(s => (unfinished(s) ? s.stack.length - s.place : null))

/** Forget a Space's place, when the Space is deleted or rescanned (its item ids start over). */
export const forgetDeclutter = spaceId => deleteChat(sessionKey(spaceId))

export default function Declutter({ space, familyVotes, onAskFamily, onSelling, onUpdateItem, onExit }) {
  const [stack, setStack] = useState(null)
  const [place, setPlace] = useState(0)
  const [history, setHistory] = useState([]) // what each decision replaced, so Undo can put it back
  const [saved, setSaved] = useState(undefined) // an unfinished session from before, or null; undefined while loading
  const key = sessionKey(space.id)

  function start() {
    setStack(buildStack(space))
    setPlace(0)
    setHistory([])
    setSaved(null)
  }

  useEffect(() => {
    deleteChat('declutter') // the old session across all Spaces, from before Declutter went per Space
    loadChat(key).then(s => {
      if (unfinished(s)) setSaved(s)
      else start()
    })
    // Runs once, when Declutter opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The session is saved as it goes, so stopping, a reload or a sleeping phone can't lose the place.
  useEffect(() => {
    if (!stack) return
    if (place >= stack.length) deleteChat(key)
    else saveChat(key, { stack, place, history, savedAt: Date.now() })
  }, [key, stack, place, history])

  if (saved === undefined) return null
  if (!stack) {
    return (
      <Resume
        space={space}
        saved={saved}
        onCancel={onExit}
        onResume={() => { setStack(saved.stack); setPlace(saved.place); setHistory(saved.history ?? []); setSaved(null) }}
        onRestart={start}
      />
    )
  }
  if (place >= stack.length) return <Summary space={space} stack={stack} onDone={onExit} onAgain={start} onAskFamily={onAskFamily} onSelling={onSelling} />

  const itemId = stack[place]
  const item = space.result?.items.find(i => i.id === itemId)
  // The item was removed since starting, so move past it.
  if (!item) {
    setTimeout(() => setPlace(p => p + 1))
    return null
  }

  function decide(status) {
    setHistory(h => [...h, { place, itemId, status: item.status }])
    onUpdateItem(itemId, { status })
    if (status !== 'sell') setPlace(p => p + 1)
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(h => h.slice(0, -1))
    onUpdateItem(last.itemId, { status: last.status })
    setPlace(last.place)
  }

  return (
    <Card
      key={itemId}
      space={space}
      item={item}
      place={place + 1}
      total={stack.length}
      canUndo={history.length > 0}
      familyVotes={familyVotes(itemId)}
      onDecide={decide}
      onSellDone={() => setPlace(p => p + 1)}
      onSkip={() => setPlace(p => p + 1)}
      onUndo={undo}
      onChange={patch => onUpdateItem(itemId, patch)}
      onStop={onExit}
    />
  )
}
