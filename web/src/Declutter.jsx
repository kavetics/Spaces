import { useEffect, useRef, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { List, ListItem } from '@astryxdesign/core/List'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { Switch } from '@astryxdesign/core/Switch'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { DECISIONS, decisionLabel, decisionOf } from './itemFields.js'
import { deleteChat, loadChat, saveChat } from './savedSpaces.js'
import SellForm from './SellForm.jsx'
import { CATEGORIES, categoryOf, countLabel, sortItems } from './spaceItems.js'
import './Inventory.css'

const categoryRank = item => CATEGORIES.findIndex(([id]) => id === categoryOf(item))
const categoryName = item => CATEGORIES.find(([id]) => id === categoryOf(item))?.[1]

/** Every item in the chosen Spaces, one Space at a time, grouped by category. */
function buildStack(spaces) {
  return spaces.flatMap(space => [...sortItems(space).inSpace]
    .sort((a, b) => categoryRank(a) - categoryRank(b))
    .map(item => ({ spaceId: space.id, itemId: item.id })))
}

/** The Spaces a session covers, in the order it goes through them. Deleted Spaces are left out. */
function spacesIn(stack, spaces) {
  const names = [...new Set(stack.map(s => s.spaceId))].map(id => spaces.find(s => s.id === id)?.spaceName).filter(Boolean)
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? ''
}

function Pick({ spaces, saved, onStart, onResume, onCancel }) {
  const ready = spaces.filter(s => s.result)
  const [chosen, setChosen] = useState(() => new Set(ready.map(s => s.id)))
  const picked = ready.filter(s => chosen.has(s.id))
  const total = picked.reduce((n, s) => n + sortItems(s).inSpace.length, 0)
  const toggle = (id, on) => setChosen(c => { const next = new Set(c); if (on) next.add(id); else next.delete(id); return next })
  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack><IconButton label="Your Spaces" icon={<Icon icon="chevronLeft" />} onClick={onCancel} /></HStack>
      {saved && (
        <VStack gap={2} className="declutter-resume">
          <Heading level={2}>Pick up where you left off</Heading>
          <Text as="p" type="label">{spacesIn(saved.stack, spaces)}</Text>
          <Text as="p" color="secondary">You stopped at {saved.place + 1} of {saved.stack.length} · {saved.stack.length - saved.place} left.</Text>
          <ProgressBar label="Items gone through" isLabelHidden value={saved.place} max={saved.stack.length} />
          <Button label="Resume" variant="primary" size="lg" onClick={onResume} />
        </VStack>
      )}
      <VStack gap={1}>
        <Heading level={1}>{saved ? 'Or start over' : 'Declutter'}</Heading>
        <Text as="p" color="secondary">Go through your things one at a time and decide what to keep, sell or let go. Choose the Spaces to include.</Text>
      </VStack>
      <VStack gap={3}>
        {ready.map(s => (
          <Switch key={s.id} label={s.spaceName} description={countLabel(sortItems(s).inSpace.length)} value={chosen.has(s.id)} onChange={on => toggle(s.id, on)} />
        ))}
      </VStack>
      <Button label={total ? `Start with ${countLabel(total)}` : 'Choose a Space'} variant={saved ? 'secondary' : 'primary'} size="lg" isDisabled={!total} onClick={() => onStart(buildStack(picked))} />
    </VStack>
  )
}

function Card({ space, item, place, total, canUndo, onDecide, onSellDone, onUndo, onSkip, onChange, onStop }) {
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

function Summary({ spaces, stack, onAgain, onDone }) {
  const items = stack.map(({ spaceId, itemId }) => {
    const space = spaces.find(s => s.id === spaceId)
    return { space, item: space?.result?.items.find(i => i.id === itemId) }
  }).filter(e => e.item)
  const selling = items.filter(e => decisionOf(e.item.status) === 'sell')
  const lettingGo = items.filter(e => decisionOf(e.item.status) === 'donate')
  const row = ({ space, item }, extra) => (
    <ListItem key={`${space.id}-${item.id}`} label={item.name} description={[space.spaceName, extra].filter(Boolean).join(' · ')} />
  )
  return (
    <VStack gap={5} padding={4} className="inventory">
      <VStack gap={1}>
        <Heading level={1}>All done</Heading>
        <Text as="p" color="secondary">You went through {countLabel(items.length)}: {selling.length} to sell, {lettingGo.length} to let go.</Text>
      </VStack>
      <VStack gap={2}>
        <Heading level={2}>To sell ({selling.length})</Heading>
        {selling.length
          ? <List hasDividers edge="flush">{selling.map(e => row(e, [money(e.item), e.item.salePhotos?.length ? null : 'needs photos'].filter(Boolean).join(' · ')))}</List>
          : <Text as="p" color="secondary">Nothing to sell.</Text>}
      </VStack>
      <VStack gap={2}>
        <Heading level={2}>To let go ({lettingGo.length})</Heading>
        {lettingGo.length
          ? <List hasDividers edge="flush">{lettingGo.map(e => row(e))}</List>
          : <Text as="p" color="secondary">Nothing to let go.</Text>}
      </VStack>
      <Button label="Done" variant="primary" size="lg" onClick={onDone} />
      <Button label="Go again" onClick={onAgain} />
    </VStack>
  )
}

/**
 * Decluttering one item at a time: pick Spaces, decide on each item with one tap, then see what to
 * sell and what to let go. Every decision is saved as it's made, so stopping partway loses nothing.
 */
const SESSION = 'declutter'
const unfinished = s => (s?.stack?.length && s.place < s.stack.length ? s : null)

/** How many items are left in a saved Declutter session, or null when there isn't one. */
export const declutterLeft = () => loadChat(SESSION).then(s => (unfinished(s) ? s.stack.length - s.place : null))

export default function Declutter({ spaces, onUpdateItem, onExit }) {
  const [stack, setStack] = useState(null)
  const [place, setPlace] = useState(0)
  const [history, setHistory] = useState([]) // what each decision replaced, so Undo can put it back
  const [saved, setSaved] = useState(undefined) // an unfinished session from before, or null; undefined while loading

  useEffect(() => { loadChat(SESSION).then(s => setSaved(unfinished(s))) }, [])

  // The session is saved as it goes, so stopping, a reload or a sleeping phone can't lose the place.
  useEffect(() => {
    if (!stack) return
    if (place >= stack.length) deleteChat(SESSION)
    else saveChat(SESSION, { stack, place, history, savedAt: Date.now() })
  }, [stack, place, history])

  if (saved === undefined) return null
  if (!stack) {
    return (
      <Pick
        spaces={spaces}
        saved={saved}
        onCancel={onExit}
        onResume={() => { setStack(saved.stack); setPlace(saved.place); setHistory(saved.history ?? []); setSaved(null) }}
        onStart={s => { setStack(s); setPlace(0); setHistory([]); setSaved(null) }}
      />
    )
  }
  if (place >= stack.length) return <Summary spaces={spaces} stack={stack} onDone={onExit} onAgain={() => setStack(null)} />

  const { spaceId, itemId } = stack[place]
  const space = spaces.find(s => s.id === spaceId)
  const item = space?.result?.items.find(i => i.id === itemId)
  // The item was removed or its Space rescanned since starting, so move past it.
  if (!item) {
    setTimeout(() => setPlace(p => p + 1))
    return null
  }

  function decide(status) {
    setHistory(h => [...h, { place, spaceId, itemId, status: item.status }])
    onUpdateItem(spaceId, itemId, { status })
    if (status !== 'sell') setPlace(p => p + 1)
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory(h => h.slice(0, -1))
    onUpdateItem(last.spaceId, last.itemId, { status: last.status })
    setPlace(last.place)
  }

  return (
    <Card
      key={`${spaceId}-${itemId}`}
      space={space}
      item={item}
      place={place + 1}
      total={stack.length}
      canUndo={history.length > 0}
      onDecide={decide}
      onSellDone={() => setPlace(p => p + 1)}
      onSkip={() => setPlace(p => p + 1)}
      onUndo={undo}
      onChange={patch => onUpdateItem(spaceId, itemId, patch)}
      onStop={onExit}
    />
  )
}
