import { useEffect, useState } from 'react'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { List, ListItem } from '@astryxdesign/core/List'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { buildInventory } from './api.js'
import './Inventory.css'

const CROP_PX = 160 // crops are shown small, at twice their size for sharp phone screens
const CROP_PADDING = 0.15 // a little of the surroundings makes an item easier to recognize
const WIDE_PADDING = 1.5 // when the tight crop failed its check, show the item in context

/** Cuts an item out of its photo. The box is in fractions of the photo. */
async function cropItem(frame, { box, wide }) {
  const bitmap = await createImageBitmap(frame)
  const padding = wide ? WIDE_PADDING : CROP_PADDING
  const padX = (box.x2 - box.x1) * padding
  const padY = (box.y2 - box.y1) * padding
  const x1 = Math.max(0, box.x1 - padX) * bitmap.width
  const y1 = Math.max(0, box.y1 - padY) * bitmap.height
  const x2 = Math.min(1, box.x2 + padX) * bitmap.width
  const y2 = Math.min(1, box.y2 + padY) * bitmap.height
  const scale = CROP_PX / Math.max(x2 - x1, y2 - y1)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((x2 - x1) * scale))
  canvas.height = Math.max(1, Math.round((y2 - y1) * scale))
  canvas.getContext('2d').drawImage(bitmap, x1, y1, x2 - x1, y2 - y1, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.8)
}

// React starts effects twice in development, and returning to this screen starts them again.
// One set of photos only ever gets one recognition run at a time, since each run costs money.
const running = new WeakMap()
function recognize(frames, space, onProgress) {
  let run = running.get(frames)
  if (!run) {
    run = { listener: onProgress }
    run.promise = buildInventory(frames, space, p => run.listener(p)).finally(() => running.delete(frames))
    running.set(frames, run)
  }
  run.listener = onProgress
  return run.promise
}

const scannedAt = ms => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Shows what's in the room, running recognition first if this scan doesn't have results yet. */
export default function Inventory({ scan, onResult, onAreaChoice, onDelete, onScanAgain }) {
  const { frames, spaceName, result, areaChoices = {}, savedAt } = scan
  const [progress, setProgress] = useState(null)
  const [crops, setCrops] = useState({})
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [askDelete, setAskDelete] = useState(false)

  useEffect(() => {
    if (result) return
    let cancelled = false
    recognize(frames, spaceName, p => { if (!cancelled) setProgress(p) })
      .then(inventory => { if (!cancelled) onResult(inventory) })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
    // onResult is new on every render; a new run depends only on the photos and retries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, spaceName, result, attempt])

  useEffect(() => {
    if (!result) return
    let cancelled = false
    Promise.all(result.items.filter(i => i.view).map(async i => [i.id, await cropItem(frames[i.view.photo], i.view).catch(() => null)]))
      .then(pairs => { if (!cancelled) setCrops(Object.fromEntries(pairs)) })
    return () => { cancelled = true }
  }, [frames, result])

  function retry() {
    setError(null)
    setProgress(null)
    setAttempt(a => a + 1)
  }

  if (error) {
    return (
      <Center className="inventory-center" padding={6}>
        <VStack gap={4} hAlign="center" role="alert">
          <Text as="p" justify="center">{error}</Text>
          <Button label="Try again" variant="primary" onClick={retry} />
          <Button label="Scan again" variant="ghost" onClick={onScanAgain} />
        </VStack>
      </Center>
    )
  }

  if (!result) {
    return (
      <Center className="inventory-center" padding={6}>
        <VStack gap={4} hAlign="center" role="status">
          <Spinner size="lg" />
          <Text as="p" justify="center">{progressText(progress, frames.length)}</Text>
        </VStack>
      </Center>
    )
  }

  const { items, warnings } = result
  const unread = warnings.failedPhotos.length
  // Scans saved before Spaces had names have no area on their items, so those all count as in the Space.
  const isNearby = item => item.inSpace === false
  const areas = [...new Set(items.filter(isNearby).map(i => i.area))]
  const inSpace = items.filter(i => !isNearby(i) || areaChoices[i.area] === 'add')
  const undecided = areas.filter(a => !areaChoices[a])
  const leftOut = areas.filter(a => areaChoices[a] === 'leave')
  const row = item => (
    <ListItem
      key={item.id}
      label={item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name}
      description={item.needsReview ? `Not sure. ${item.description}` : item.description}
      startContent={crops[item.id] ? <img className="inventory-crop" src={crops[item.id]} alt="" /> : <span className="inventory-crop" />}
    />
  )
  return (
    <VStack gap={4} padding={4} className="inventory">
      <VStack gap={1}>
        <Heading level={1}>{spaceName || 'Your room'}</Heading>
        <Text as="p" color="secondary">{inSpace.length === 1 ? '1 item' : `${inSpace.length} items`}. Scanned {scannedAt(savedAt)}.</Text>
      </VStack>
      {unread > 0 && <Banner status="warning" title={`${unread} ${unread === 1 ? 'photo' : 'photos'} couldn't be read, so some items may be missing.`} />}
      {items.length === 0 && <Text as="p">We didn't find anything. Try scanning again with more light.</Text>}
      {inSpace.length > 0 && <List hasDividers edge="flush">{inSpace.map(row)}</List>}

      {undecided.length > 0 && <Heading level={2}>Also spotted nearby</Heading>}
      {undecided.map(area => (
        <VStack key={area} gap={2}>
          <Heading level={3}>{area}</Heading>
          <List hasDividers edge="flush">{items.filter(i => isNearby(i) && i.area === area).map(row)}</List>
          <HStack gap={2}>
            <Button label="Add to this Space" onClick={() => onAreaChoice(area, 'add')} />
            <Button label="Leave out" variant="ghost" onClick={() => onAreaChoice(area, 'leave')} />
          </HStack>
        </VStack>
      ))}

      {leftOut.map(area => (
        <HStack key={area} gap={2} vAlign="center" hAlign="between">
          <Text color="secondary">Left out: {area}</Text>
          <Button label={`Add ${area} back`} variant="ghost" size="sm" onClick={() => onAreaChoice(area, 'add')} />
        </HStack>
      ))}

      <Button label="Scan again" onClick={onScanAgain} />
      <Button label="Delete this scan" variant="ghost" onClick={() => setAskDelete(true)} />
      <AlertDialog
        isOpen={askDelete}
        onOpenChange={setAskDelete}
        title="Delete this scan?"
        description="This removes its photos and item list from this phone. You can't undo this."
        actionLabel="Delete scan"
        onAction={onDelete}
      />
    </VStack>
  )
}

function progressText(progress, photos) {
  if (progress?.step === 'checking') return 'Double-checking what we found…'
  if (progress?.step === 'merging') return 'Checking for repeats across your photos…'
  if (progress?.step === 'photos') return `Looking through your photos: ${progress.done} of ${progress.total}`
  return photos === 1 ? 'Looking through your photo…' : 'Looking through your photos…'
}
