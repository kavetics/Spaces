import { useEffect, useState } from 'react'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
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
import { cropItem } from './crop.js'
import { decisionLabel, progress as itemProgress } from './itemFields.js'
import { CATEGORIES, categoryOf, scannedAt, sortItems } from './spaceItems.js'
import './Inventory.css'

// Sharing with the Muse app works for one household, the owner's, so it's hidden unless a build turns it on.
// Everything else in the app works for anyone without it.
const SHOW_SHARING = import.meta.env.VITE_SHOW_SHARING === 'true'
const NEARBY = 'nearby'
const INVENTORY = 'inventory'
const STARTS_CLOSED = [NEARBY, INVENTORY]
const UNDO_MS = 6000
/** One Space: its items by category, or its progress while they're being found. */
export default function Inventory({ space, progress, error, onRetry, onItemChoice, onRemoveItem, onSectionToggle, onDelete, onRescan, onBack, onAsk, onOpenItem, shareError, hasOwnerKey, onShare }) {
  const { frames, spaceName, result, savedAt, openSections = {} } = space
  const toast = useToast()
  const [crops, setCrops] = useState({})
  const [askDelete, setAskDelete] = useState(false)
  const [askRescan, setAskRescan] = useState(false)
  const [askKey, setAskKey] = useState(false)
  const [typedKey, setTypedKey] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareProblem, setShareProblem] = useState(null)

  useEffect(() => {
    if (!result) return
    let cancelled = false
    Promise.all(result.items.filter(i => i.view).map(async i => [i.id, await cropItem(frames[i.view.photo], i.view).catch(() => null)]))
      .then(pairs => { if (!cancelled) setCrops(Object.fromEntries(pairs)) })
    return () => { cancelled = true }
  }, [frames, result])

  const backButton = <IconButton label="Your Spaces" icon={<Icon icon="chevronLeft" />} onClick={onBack} />
  const dialogs = (
    <>
      <AlertDialog
        isOpen={askRescan}
        onOpenChange={setAskRescan}
        title={`Rescan ${spaceName}?`}
        description="Your new scan replaces these photos and this item list, including what you added or removed."
        actionLabel="Rescan"
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
      <Dialog isOpen={askKey} onOpenChange={setAskKey} purpose="form" width={420}>
        <Layout
          header={<DialogHeader title="Enter your owner key" onOpenChange={setAskKey} />}
          content={
            <LayoutContent>
              <VStack gap={3}>
                <Text as="p">Only someone with this key can share Spaces from this app. You only need to enter it once on this phone.</Text>
                <TextInput label="Owner key" type="password" value={typedKey} onChange={setTypedKey} />
                <Button label="Share" variant="primary" isDisabled={!typedKey.trim() || sharing} onClick={() => toggleShare(true, typedKey.trim())} />
              </VStack>
            </LayoutContent>
          }
        />
      </Dialog>
    </>
  )

  async function toggleShare(on, key) {
    if (on && !key && !hasOwnerKey) { setAskKey(true); return }
    setSharing(true)
    setShareProblem(null)
    try {
      await onShare(on, key)
      setAskKey(false)
      setTypedKey('')
    } catch (err) {
      if (err.wrongKey) setAskKey(true)
      setShareProblem(err.message)
    } finally {
      setSharing(false)
    }
  }

  if (error) {
    return (
      <VStack gap={4} padding={4} className="inventory">
        <HStack>{backButton}</HStack>
        <VStack gap={4} hAlign="center" role="alert">
          <Heading level={1}>{spaceName}</Heading>
          <Text as="p" justify="center">{error}</Text>
          <Button label="Try again" variant="primary" onClick={onRetry} />
          <Button label="Rescan" onClick={() => setAskRescan(true)} />
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
          <Spinner size="lg" />
          <Text as="p" justify="center">{progressText(progress, frames.length)}</Text>
          <Text as="p" color="secondary" justify="center">This takes about 2 minutes. Keep your screen on.</Text>
        </VStack>
      </VStack>
    )
  }

  const { items, warnings } = result
  const unread = warnings.failedPhotos.length
  const { inSpace, nearby } = sortItems(space)
  const areas = [...new Set(nearby.map(i => i.area))]
  // Removing is immediate and real, so a mis-tap gets a few seconds to take it back.
  function remove(item) {
    const undo = onRemoveItem(item)
    const dismiss = toast({ body: `Removed ${item.name}`, autoHideDuration: UNDO_MS, endContent: <Button label="Undo" size="sm" onClick={() => { undo(); dismiss() }} /> })
  }
  const action = (item, label, onClick) => <Button label={label} aria-label={`${label}: ${item.name}`} size="sm" variant="ghost" onClick={onClick} />
  // Full names and descriptions wrap instead of being cut off. Actions under the text leave them room.
  const row = (item, sideAction, actionsBelow) => (
    <ListItem
      key={item.id}
      align="start"
      label={<Text as="p">{item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name}</Text>}
      onClick={actionsBelow ? undefined : () => onOpenItem(item.id)}
      description={(
        <VStack gap={1}>
          {decisionLabel(item.status) && <Text as="p" type="label">{statusLine(item)}</Text>}
          <Text as="p" type="supporting">{item.needsReview ? `Not sure. ${item.description}` : item.description}</Text>
          {actionsBelow}
        </VStack>
      )}
      startContent={crops[item.id] ? <img className="inventory-crop" src={crops[item.id]} alt="" /> : <span className="inventory-crop" />}
      endContent={sideAction}
    />
  )
  // Sections stay as they were left. The big ones start closed to keep the page short.
  const section = (key, title, children, level = 2) => (
    <Collapsible
      key={key}
      isOpen={openSections[key] ?? !STARTS_CLOSED.includes(key)}
      onOpenChange={open => onSectionToggle(key, open)}
      trigger={<Heading level={level}>{title}</Heading>}
    >
      {children}
    </Collapsible>
  )
  return (
    <VStack gap={4} padding={4} className="inventory">
      <HStack>{backButton}</HStack>
      <VStack gap={1}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <Heading level={1}>{spaceName}</Heading>
          <Button label="Delete Space" variant="ghost" size="sm" onClick={() => setAskDelete(true)} />
        </HStack>
        <HStack gap={2} vAlign="center" hAlign="between">
          <Text color="secondary">Scanned {scannedAt(savedAt)}</Text>
          <Button label="Rescan" size="sm" onClick={() => setAskRescan(true)} />
        </HStack>
        {SHOW_SHARING && <Switch
          label="Share with Muse"
          description="Sends this Space's item names and details to your Spaces server, so the Muse app can read them. Photos stay on this phone."
          value={Boolean(space.shared)}
          isDisabled={sharing}
          onChange={on => toggleShare(on)}
        />}
        {(shareProblem || shareError) && <Text as="p" role="alert" color="secondary">{shareProblem || `Muse may see an older list: ${shareError}`}</Text>}
      </VStack>
      {unread > 0 && <Banner status="warning" title={`${unread} ${unread === 1 ? 'photo' : 'photos'} couldn't be read, so some items may be missing.`} />}
      {items.length === 0 && <Text as="p">We didn't find anything. Try scanning again with more light.</Text>}
      {inSpace.length > 0 && <Text as="p" color="secondary">{progressLine(itemProgress(inSpace))}</Text>}
      {inSpace.length > 0 && section(INVENTORY, `Digital inventory (${inSpace.length})`, (
        <VStack gap={3}>
          {CATEGORIES.map(([id, label]) => {
            const inCategory = inSpace.filter(i => categoryOf(i) === id)
            if (!inCategory.length) return null
            const sure = inCategory.filter(i => !i.needsReview)
            const unsure = inCategory.filter(i => i.needsReview)
            return section(id, `${label} (${inCategory.length})`, (
              <List hasDividers edge="flush">{[...sure, ...unsure].map(i => row(i, action(i, 'Remove', () => remove(i))))}</List>
            ), 3)
          })}
        </VStack>
      ))}

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
      ))}

      <Button label={`Ask Muse about ${spaceName}`} variant="primary" size="lg" onClick={onAsk} />
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

function statusLine(item) {
  const value = item.details?.askingPrice ?? item.details?.estimatedValue?.amount
  const priced = item.status === 'sell' && value ? ` · $${value}${item.details?.askingPrice ? '' : ' AI estimate'}` : ''
  return `${decisionLabel(item.status)}${priced}`
}

function progressLine({ decided, total, selling, value }) {
  const sale = selling ? ` · ${selling} to sell${value ? `, about $${value}` : ''}` : ''
  return `${decided} of ${total} decided${sale}`
}
