import { useEffect, useRef, useState } from 'react'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Badge } from '@astryxdesign/core/Badge'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Divider } from '@astryxdesign/core/Divider'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Switch } from '@astryxdesign/core/Switch'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { List, ListItem } from '@astryxdesign/core/List'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { useToast } from '@astryxdesign/core/Toast'
import { VStack } from '@astryxdesign/core/VStack'
import { shrinkPhoto } from './api.js'
import { byYou, decisionLabel, decisionOf, progress as itemProgress } from './itemFields.js'
import Initials, { peopleLabel } from './Initials.jsx'
import ItemForm from './ItemForm.jsx'
import ScanPulse from './ScanPulse.jsx'
import { CATEGORIES, categoryOf, countLabel, scannedAt, sortItems } from './spaceItems.js'
import './Inventory.css'

// Sending shared Spaces to Muse in the Meta AI app works for one household, the owner's, so entering the owner
// key is offered only in builds that turn it on. Share with Muse itself (for Ask Muse) works for anyone.
const SHOW_SHARING = import.meta.env.VITE_SHOW_SHARING === 'true'
const NEARBY = 'nearby'
const INVENTORY = 'inventory'
const STARTS_CLOSED = [NEARBY, INVENTORY]
const UNDO_MS = 6000
/** One Space: its items by category, or its progress while they're being found. */
export default function Inventory({ space, progress, error, onRetry, onItemChoice, onRemoveItem, onSectionToggle, onDelete, onRescan, onBack, onOpenItem, focusItem, onFocused, shareError, hasOwnerKey, onShare, onScanMore, onAddPhotos, onDiscardAdded, onConfirmRepeat, onAddItem, onDeclutter, declutterLeft, usedBy, voteCard, onSelling, onPeople, onOwnerKey }) {
  const { frames, spaceName, result, savedAt, openSections = {} } = space
  const toast = useToast()
  const [addingItem, setAddingItem] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const [askRescan, setAskRescan] = useState(false)
  const [showMore, setShowMore] = useState(false) // Scan again and Delete Space
  const addInput = useRef(null)
  const [askKey, setAskKey] = useState(false)
  const [typedKey, setTypedKey] = useState('')
  const [sharing, setSharing] = useState(false)
  const [askShare, setAskShare] = useState(false) // confirming Share with Muse
  const inSpaceCount = result ? sortItems(space).inSpace.length : 0
  const [shareProblem, setShareProblem] = useState(null)

  // After saving an item, bring it into view in the list.
  useEffect(() => {
    if (focusItem == null) return
    const timer = setTimeout(() => {
      document.querySelector(`[data-item="${focusItem}"]`)?.scrollIntoView?.({ block: 'center' })
      onFocused()
    }, 100)
    return () => clearTimeout(timer)
    // onFocused is new on every render; this should run once per saved item.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusItem])


  const backButton = <IconButton label="My home" icon={<Icon icon="chevronLeft" />} onClick={onBack} />
  const dialogs = (
    <>
      <AlertDialog
        isOpen={askRescan}
        onOpenChange={setAskRescan}
        title={`Start ${spaceName} over?`}
        description="Your new scan replaces these photos and the scanned things, including your edits and removals. Things you added by hand stay."
        actionLabel="Start over"
        actionVariant="primary"
        onAction={() => { setAskRescan(false); onRescan() }}
      />
      <AlertDialog
        isOpen={askDelete}
        onOpenChange={setAskDelete}
        title={`Delete ${spaceName}?`}
        description="This removes its photos and item list from this phone. You can't undo this."
        actionLabel="Delete Space"
        onAction={async () => {
          try { await onDelete() } catch (err) {
            setAskDelete(false)
            setShareProblem(`Couldn't stop sharing, so nothing was deleted. ${err.message}`)
          }
        }}
      />
      {/* "Add more" and "Rescan" were two flows for one intention, scanning again; adding is what's wanted almost always. */}
      <Dialog isOpen={showMore} onOpenChange={setShowMore} width={420}>
        <Layout
          header={<DialogHeader title={`Scan the ${spaceName.toLowerCase()} again`} onOpenChange={setShowMore} />}
          content={
            <LayoutContent>
              <VStack gap={4}>
                <VStack gap={2}>
                  <Heading level={3}>Add to this Space</Heading>
                  <Text as="p" color="secondary">Keeps your things, decisions and edits. New things are checked for repeats.</Text>
                  <Button label="Scan from another spot" variant="primary" isDisabled={Boolean(space.addFrames)} onClick={() => { setShowMore(false); onScanMore() }} />
                  <Button label="Add photos" isDisabled={Boolean(space.addFrames)} onClick={() => addInput.current?.click()} />
                </VStack>
                <VStack gap={2}>
                  <Heading level={3}>Start over</Heading>
                  <Text as="p" color="secondary">Replaces the scanned things. Things you added by hand stay.</Text>
                  <Button label="Start over" isDisabled={Boolean(space.addFrames)} onClick={() => { setShowMore(false); setAskRescan(true) }} />
                </VStack>
                {SHOW_SHARING && !hasOwnerKey && (
                  <VStack gap={2}>
                    <Heading level={3}>Meta AI app</Heading>
                    <Text as="p" color="secondary">For the owner's household only: lets Muse in the Meta AI app read the Spaces you share.</Text>
                    <Button label="Enter owner key" onClick={() => { setShowMore(false); setAskKey(true) }} />
                  </VStack>
                )}
                <Divider />
                <Button label="Delete Space" variant="destructive" onClick={() => { setShowMore(false); setAskDelete(true) }} />
              </VStack>
            </LayoutContent>
          }
        />
      </Dialog>
      <Dialog isOpen={askKey} onOpenChange={setAskKey} purpose="form" width={420}>
        <Layout
          header={<DialogHeader title="Enter your owner key" onOpenChange={setAskKey} />}
          content={
            <LayoutContent>
              <VStack gap={3}>
                <Text as="p">With this key, the Spaces you share with Muse also go to the Spaces server, where Muse in the Meta AI app can read them. You only need to enter it once on this phone.</Text>
                <TextInput label="Owner key" type="password" value={typedKey} onChange={setTypedKey} />
                {shareProblem && askKey && <Text as="p" role="alert" color="secondary">{shareProblem}</Text>}
                <Button label="Connect" variant="primary" isDisabled={!typedKey.trim() || sharing} onClick={() => connect(typedKey.trim())} />
              </VStack>
            </LayoutContent>
          }
        />
      </Dialog>
      {/* Turning sharing on says plainly what leaves the phone before anything does. */}
      <Dialog isOpen={askShare} onOpenChange={setAskShare} width={420}>
        <Layout
          header={<DialogHeader title={`Share ${spaceName} with Muse?`} onOpenChange={setAskShare} />}
          content={
            <LayoutContent>
              <VStack gap={3}>
                <Banner
                  status="info"
                  title="This sends your data off this phone"
                  description={hasOwnerKey ? "To Meta's AI and to the Spaces server. You can turn it off any time." : "To Meta's AI, each time you ask Muse something. You can turn it off any time."}
                />
                <List edge="flush">
                  <ListItem label={<Text as="p">Ask Muse on My home can use its {countLabel(inSpaceCount, 'thing')}, who uses it and your decisions.</Text>} />
                  {hasOwnerKey && <ListItem label={<Text as="p">Muse in the Meta AI app can read the same list, saved on the Spaces server.</Text>} />}
                  {hasOwnerKey && <ListItem label={<Text as="p">Things marked Sell also send up to 3 sale photos and their listing draft.</Text>} />}
                  <ListItem label={<Text as="p">Room photos stay on this phone.</Text>} />
                </List>
                <Button label="Share with Muse" variant="primary" isDisabled={sharing} isLoading={sharing} onClick={() => toggleShare(true)} />
                <Button label="Not now" variant="ghost" onClick={() => setAskShare(false)} />
              </VStack>
            </LayoutContent>
          }
        />
      </Dialog>
    </>
  )

  async function toggleShare(on) {
    setSharing(true)
    setShareProblem(null)
    try {
      await onShare(on)
      setAskShare(false)
    } catch (err) {
      setAskShare(false)
      setShareProblem(err.message)
    } finally {
      setSharing(false)
    }
  }

  async function connect(key) {
    setSharing(true)
    setShareProblem(null)
    try {
      await onOwnerKey(key)
      setAskKey(false)
      setTypedKey('')
    } catch (err) {
      setShareProblem(err.wrongKey ? 'That owner key is wrong.' : err.message)
    } finally {
      setSharing(false)
    }
  }

  if (error && !result) {
    return (
      <VStack gap={4} padding={4} className="inventory">
        <HStack>{backButton}</HStack>
        <VStack gap={4} hAlign="center" role="alert">
          <Heading level={1}>{spaceName}</Heading>
          <Text as="p" justify="center">{error}</Text>
          <Button label="Try again" variant="primary" onClick={onRetry} />
          <Button label="Start over" onClick={() => setAskRescan(true)} />
          <Button label="Delete Space" variant="ghost" onClick={() => setAskDelete(true)} />
        </VStack>
        {dialogs}
      </VStack>
    )
  }

  if (!result) {
    return (
      <VStack gap={4} padding={4} className="inventory">
        <HStack>{backButton}</HStack>
        <VStack gap={4} hAlign="center" role="status">
          <Heading level={1}>{spaceName}</Heading>
          <ScanPulse />
          <Text as="p" justify="center">{progressText(progress, frames.length)}</Text>
          <Text as="p" color="secondary" justify="center">This takes about 2 minutes. Keep your screen on.</Text>
        </VStack>
      </VStack>
    )
  }

  const { items, warnings } = result
  const unread = warnings.failedPhotos.length
  const { inSpace, nearby, repeats } = sortItems(space)
  const adding = Boolean(space.addFrames)

  async function addFromLibrary(event) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    setShowMore(false)
    onAddPhotos((await Promise.all(files.map(f => shrinkPhoto(f).catch(() => null)))).filter(Boolean))
  }
  const areas = [...new Set(nearby.map(i => i.area))]
  // Removing is immediate and real, so a mis-tap gets a few seconds to take it back.
  function remove(item) {
    const undo = onRemoveItem(item)
    const dismiss = toast({ body: `Removed ${item.name}`, autoHideDuration: UNDO_MS, endContent: <Button label="Undo" onClick={() => { undo(); dismiss() }} /> })
  }
  const action = (item, label, onClick) => <Button label={label} aria-label={`${label}: ${item.name}`} variant="ghost" className={label === 'Remove' ? 'quiet-action' : undefined} onClick={onClick} />
  // Full names and descriptions wrap instead of being cut off. Actions under the text leave them room.
  const row = (item, sideAction, actionsBelow) => (
    <ListItem
      key={item.id}
      align="start"
      label={<Text as="p">{item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name}</Text>}
      onClick={actionsBelow ? undefined : () => onOpenItem(item.id)}
      description={(
        <VStack gap={1}>
          {decisionLabel(item.status) && (
            <HStack gap={2} vAlign="center">
              <Badge label={price(item) ? `${decisionLabel(item.status)} · $${price(item).amount}` : decisionLabel(item.status)} variant={DECISION_COLORS[decisionOf(item.status)]} className={decisionOf(item.status) === 'donate' ? 'let-go-tag' : undefined} />
              {price(item) && <Text type="supporting" color="secondary">{price(item).source}</Text>}
            </HStack>
          )}
          {byYou(item) && <Text as="p" type="supporting">{byYou(item)}</Text>}
          {item.description && <Text as="p" type="supporting">{item.needsReview ? `Not sure. ${item.description}` : item.description}</Text>}
          {actionsBelow}
        </VStack>
      )}
      startContent={item.picture ? <img className="inventory-crop" src={item.picture} alt="" data-item={item.id} /> : <span className="inventory-crop" data-item={item.id} />}
      endContent={sideAction}
    />
  )
  // Sections stay as they were left. The big ones start closed to keep the page short.
  const section = (key, title, children, level = 2, className) => (
    <Collapsible
      key={key}
      className={className}
      isOpen={openSections[key] ?? !STARTS_CLOSED.includes(key)}
      onOpenChange={open => onSectionToggle(key, open)}
      trigger={<Heading level={level}>{title}</Heading>}
    >
      {children}
    </Collapsible>
  )
  const decided = itemProgress(inSpace)
  const hasSelling = inSpace.some(i => ['sell', 'donate'].includes(decisionOf(i.status)))
  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack gap={2} vAlign="center" hAlign="between">
        {backButton}
        <IconButton label="More" icon={<Icon icon="moreHorizontal" />} onClick={() => setShowMore(true)} />
      </HStack>
      <VStack gap={1}>
        <Heading level={1}>{spaceName}</Heading>
        <Text color="secondary">Scanned {scannedAt(savedAt)} · {countLabel(inSpace.length, 'thing')}</Text>
      </VStack>
      {unread > 0 && <Banner status="warning" title={`${unread} ${unread === 1 ? 'photo' : 'photos'} couldn't be read, so some things may be missing.`} />}
      {items.length === 0 && <Text as="p">We didn't find anything. Try scanning again with more light.</Text>}
      <input ref={addInput} type="file" accept="image/*" multiple hidden onChange={addFromLibrary} />
      {adding && !error && (
        <HStack gap={2} vAlign="center" role="status">
          <Spinner size="md" />
          <Text>{progressText(progress, space.addFrames.length).replace('your photos', 'your new photos')}</Text>
        </HStack>
      )}
      {adding && error && (
        <VStack gap={2} role="alert">
          <Banner status="error" title="Couldn't add your new photos" description={error} />
          <HStack gap={2}>
            <Button label="Try again" variant="primary" onClick={onRetry} />
            <Button label="Discard them" variant="ghost" onClick={onDiscardAdded} />
          </HStack>
        </VStack>
      )}
      {repeats.length > 0 && (
        <VStack gap={2}>
          <Heading level={2}>Possible repeats ({repeats.length})</Heading>
          <Text as="p" color="secondary">These items from your new photos may already be listed, seen from another angle.</Text>
          <List hasDividers edge="flush">
            {repeats.map(item => {
              const same = result.items.find(i => i.id === item.possibleRepeatOf)
              return (
                <ListItem
                  key={item.id}
                  align="start"
                  label={<Text as="p">{item.name}</Text>}
                  description={(
                    <VStack gap={1}>
                      <Text as="p" type="supporting">{same ? `Same as your ${same.name}?` : item.description}</Text>
                      <HStack gap={1}>
                        <Button label="Same item" aria-label={`Same item: ${item.name}`} variant="ghost" onClick={() => onConfirmRepeat(item, true)} />
                        <Button label="Different" aria-label={`Different: ${item.name}`} variant="ghost" onClick={() => onConfirmRepeat(item, false)} />
                      </HStack>
                    </VStack>
                  )}
                  startContent={(
                    <HStack gap={1}>
                      {item.picture ? <img className="inventory-crop" src={item.picture} alt="" /> : <span className="inventory-crop" />}
                      {same?.picture && <img className="inventory-crop" src={same.picture} alt={`Your ${same.name}`} />}
                    </HStack>
                  )}
                />
              )
            })}
          </List>
        </VStack>
      )}

      {/* Things */}
      <VStack gap={2}>
        {inSpace.length > 0
          ? (
            // Add sits on the heading's row but outside the dropdown's trigger, since a button can't hold another button.
            <VStack className="inventory-with-action">
              <Button label="Add" aria-label="Add a thing" className="inventory-action" onClick={() => setAddingItem(true)} />
              {section(INVENTORY, `Things (${inSpace.length})`, (
                <VStack gap={5} className="things-list">
                  {CATEGORIES.map(([id, label]) => {
                    const inCategory = inSpace.filter(i => categoryOf(i) === id)
                    if (!inCategory.length) return null
                    const sure = inCategory.filter(i => !i.needsReview)
                    const unsure = inCategory.filter(i => i.needsReview)
                    return section(id, `${label} (${inCategory.length})`, (
                      <List hasDividers edge="flush">{[...sure, ...unsure].map(i => row(i, action(i, 'Remove', () => remove(i))))}</List>
                    ), 3, 'things-category')
                  })}
                </VStack>
              ), 2, 'inventory-action-trigger')}
            </VStack>
          )
          : (
            <HStack gap={2} vAlign="center" hAlign="between">
              <Heading level={2}>Things</Heading>
              <Button label="Add" aria-label="Add a thing" onClick={() => setAddingItem(true)} />
            </HStack>
          )}
        {nearby.length > 0 && section(NEARBY, `Also spotted nearby (${nearby.length})`, (
          <VStack gap={3}>
            {areas.map(area => (
              <VStack key={area} gap={2}>
                <Heading level={3}>{area}</Heading>
                <List hasDividers edge="flush">
                  {nearby.filter(i => i.area === area).map(i => row(i, null, (
                    <HStack gap={1}>
                      {action(i, 'Add', () => onItemChoice(i.id, 'add'))}
                      {action(i, 'Remove', () => remove(i))}
                    </HStack>
                  )))}
                </List>
              </VStack>
            ))}
          </VStack>
        ), 3)}
      </VStack>

      <Divider />
      {/* People */}
      <VStack gap={1}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <Heading level={2}>People</Heading>
          <Button label={usedBy?.length ? 'Edit' : 'Add'} aria-label={usedBy?.length ? 'Edit people' : 'Add people'} onClick={onPeople} />
        </HStack>
        {usedBy?.length
          ? (
            <HStack gap={2} vAlign="center">
              <Initials people={usedBy} />
              <Text as="p" color="secondary">{peopleLabel(usedBy.length)} · {andList(usedBy.map(p => p.name))}</Text>
            </HStack>
          )
          : <Text as="p" color="secondary">Add who shares this Space.</Text>}
      </VStack>

      {inSpace.length > 0 && (
        <>
          <Divider />
          {/* Decisions */}
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Decisions</Heading>
              <Text as="p" color="secondary">{progressLine(decided)}</Text>
            </VStack>
            <Button label={declutterLeft ? `Resume decluttering · ${declutterLeft} left` : 'Declutter this Space'} variant="primary" onClick={onDeclutter} />
            {voteCard}
            {hasSelling && (
              <HStack gap={2} vAlign="center" hAlign="between">
                <Text as="p">For sale and letting go</Text>
                <Button label="See list" onClick={onSelling} />
              </HStack>
            )}
          </VStack>
        </>
      )}

      <Divider />
      {/* Muse */}
      <VStack gap={2}>
        <Heading level={2}>Muse</Heading>
        <Switch
          label="Share with Muse"
          description={space.shared
            ? `On. Muse can see this Space's ${countLabel(inSpace.length, 'thing')}.`
            : "Off. Muse can't see this Space."}
          value={Boolean(space.shared)}
          isDisabled={sharing}
          onChange={on => (on ? setAskShare(true) : toggleShare(false))}
        />
        {(shareProblem || shareError) && <Text as="p" role="alert" color="secondary">{shareProblem || `Muse may see an older list: ${shareError}`}</Text>}
      </VStack>
      {addingItem && <ItemForm spaceName={spaceName} onClose={() => setAddingItem(false)} onSave={fields => { setAddingItem(false); onAddItem(fields) }} />}
      {dialogs}
    </VStack>
  )
}

function progressText(progress, photos) {
  if (progress?.step === 'checking') return 'Double-checking what we found…'
  if (progress?.step === 'merging') return 'Checking for repeats across your photos…'
  if (progress?.step === 'photos') return `Looking through your photos: ${progress.done} of ${progress.total}`
  return photos === 1 ? 'Looking through your photo…' : 'Looking through your photos…'
}

// Each decision gets its own tag, so it stands apart from the item's name. Keep is grey: nothing left to do.
// Let go is red like Delete; Sell is gold and carries its price.
const DECISION_COLORS = { keep: 'neutral', sell: 'yellow', donate: 'red' }

// A Sell item's price: the asking price once the person sets one, otherwise Muse's estimate, labelled as such.
function price(item) {
  if (item.status !== 'sell') return null
  if (item.details?.askingPrice) return { amount: item.details.askingPrice, source: 'Asking price' }
  const estimate = item.details?.estimatedValue?.amount
  return estimate ? { amount: estimate, source: 'AI estimate' } : null
}

const andList = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0])

function progressLine({ decided, total, selling, value }) {
  const sale = selling ? ` · ${selling} to sell${value ? `, about $${value}` : ''}` : ''
  return `${decided} of ${total} decided${sale}`
}
