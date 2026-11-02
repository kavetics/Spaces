import { useEffect, useRef, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { describeForSale, shrinkPhoto } from './api.js'
import { cropItem } from './crop.js'
import { CONDITIONS, DECISIONS, LISTING, editDetail, mergeAiDetails } from './itemFields.js'
import { categoryOf, CATEGORIES } from './spaceItems.js'
import './Inventory.css'

const MAX_SALE_PHOTOS = 6
const list = text => text.split(',').map(s => s.trim()).filter(Boolean)

function Thumbnail({ blob, onRemove }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    const made = URL.createObjectURL(blob)
    setUrl(made)
    return () => URL.revokeObjectURL(made)
  }, [blob])
  return (
    <VStack gap={1} hAlign="center">
      {url && <img className="item-sale-photo" src={url} alt="Photo for selling" />}
      <Button label="Remove" variant="ghost" size="sm" onClick={onRemove} />
    </VStack>
  )
}

/** One item: its decision, and when it's for sale, the photos and details a listing needs. */
export default function ItemDetail({ space, item, onChange, onBack }) {
  const details = item.details ?? {}
  const ai = new Set(details.aiFields ?? [])
  const salePhotos = item.salePhotos ?? []
  const [crop, setCrop] = useState(null)
  const [filling, setFilling] = useState(false)
  const [fillError, setFillError] = useState(null)
  const fileInput = useRef(null)
  const category = CATEGORIES.find(([id]) => id === categoryOf(item))?.[1]

  useEffect(() => {
    if (!item.view) return
    let cancelled = false
    cropItem(space.frames[item.view.photo], item.view, 480).then(url => { if (!cancelled) setCrop(url) }).catch(() => {})
    return () => { cancelled = true }
  }, [space.frames, item.view])

  const set = (key, value) => onChange({ details: editDetail(details, key, value) })
  const label = (name, key) => (ai.has(key) ? `${name} (AI estimate)` : name)

  async function addPhotos(event) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    const small = (await Promise.all(files.map(f => shrinkPhoto(f).catch(() => null)))).filter(Boolean)
    onChange({ salePhotos: [...salePhotos, ...small].slice(0, MAX_SALE_PHOTOS) })
  }

  async function fillFromPhotos() {
    setFilling(true)
    setFillError(null)
    try {
      const { details: found } = await describeForSale(salePhotos, item)
      onChange({ details: mergeAiDetails(details, found) })
    } catch (err) {
      setFillError(err.message)
    } finally {
      setFilling(false)
    }
  }

  const value = details.estimatedValue
  const dims = details.dimensions ?? {}
  const setDim = (key, v) => set('dimensions', { ...dims, unit: 'in', [key]: v })

  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack><IconButton label={space.spaceName} icon={<Icon icon="chevronLeft" />} onClick={onBack} /></HStack>
      <VStack gap={3}>
        {crop && <img className="item-photo" src={crop} alt={item.name} />}
        <VStack gap={1}>
          <Heading level={1}>{item.name}</Heading>
          <Text color="secondary">{[space.spaceName, category, item.quantity > 1 ? `${item.quantity} of these` : null].filter(Boolean).join(' · ')}</Text>
          <Text as="p">{item.description}</Text>
        </VStack>
      </VStack>

      <VStack gap={2}>
        <Heading level={2}>What should happen to it?</Heading>
        <SegmentedControl label="Decision" value={item.status ?? ''} onChange={status => onChange({ status })}>
          {DECISIONS.map(([id, name]) => <SegmentedControlItem key={id} value={id} label={name} />)}
        </SegmentedControl>
      </VStack>

      {item.status === 'sell' && (
        <>
          <VStack gap={2}>
            <Heading level={2}>Photos for selling</Heading>
            <Text as="p" color="secondary">Take 2 to 4 photos: the front, the back, any labels or model numbers, and any damage. These stay on this phone, and help fill in the details below.</Text>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
            {salePhotos.length > 0 && (
              <Grid columns={3} gap={2}>
                {salePhotos.map((blob, i) => <Thumbnail key={i} blob={blob} onRemove={() => onChange({ salePhotos: salePhotos.filter((_, n) => n !== i) })} />)}
              </Grid>
            )}
            <HStack gap={2}>
              {salePhotos.length < MAX_SALE_PHOTOS && <Button label="Add photos" onClick={() => fileInput.current?.click()} />}
              <Button label="Fill in details with AI" variant="primary" isDisabled={!salePhotos.length} isLoading={filling} onClick={fillFromPhotos} />
            </HStack>
            {fillError && <Text as="p" role="alert">{fillError}</Text>}
          </VStack>

          {ai.size > 0 && <Banner status="info" title="Some details are from AI and may not be accurate." description="Check each one marked AI estimate before you list it. Changing a field makes it yours." />}

          <VStack gap={3}>
            <Heading level={2}>Details for a listing</Heading>
            <TextInput label={label('Brand', 'brand')} value={details.brand ?? ''} onChange={v => set('brand', v || null)} />
            <TextInput label={label('Model', 'model')} value={details.model ?? ''} onChange={v => set('model', v || null)} />
            <TextInput label={label('Size', 'size')} placeholder="55-inch, 3-seat" value={details.size ?? ''} onChange={v => set('size', v || null)} />
            <VStack gap={1}>
              <Text type="label">{label('Condition', 'condition')}</Text>
              <SegmentedControl label="Condition" value={details.condition ?? ''} onChange={v => set('condition', v)}>
                {CONDITIONS.map(([id, name]) => <SegmentedControlItem key={id} value={id} label={name} />)}
              </SegmentedControl>
            </VStack>
            <TextArea label={label('Condition notes', 'conditionNotes')} value={details.conditionNotes ?? ''} onChange={v => set('conditionNotes', v || null)} />
            <TextInput label={label('Defects, separated by commas', 'defects')} value={(details.defects ?? []).join(', ')} onChange={v => set('defects', list(v))} />
            <TextInput label={label('Included items, separated by commas', 'includedItems')} placeholder="remote, cushions" value={(details.includedItems ?? []).join(', ')} onChange={v => set('includedItems', list(v))} />
            <Text type="label">{label('Dimensions in inches', 'dimensions')}</Text>
            <Grid columns={3} gap={2}>
              <NumberInput label="Width" min={0} value={dims.width ?? null} onChange={v => setDim('width', v)} />
              <NumberInput label="Height" min={0} value={dims.height ?? null} onChange={v => setDim('height', v)} />
              <NumberInput label="Depth" min={0} value={dims.depth ?? null} onChange={v => setDim('depth', v)} />
            </Grid>
            {Object.keys(details.attributes ?? {}).length > 0 && (
              <VStack gap={1}>
                <Text type="label">{label('Features', 'attributes')}</Text>
                {Object.entries(details.attributes).map(([k, v]) => <Text key={k} as="p">{k}: {v}</Text>)}
              </VStack>
            )}
            <VStack gap={1}>
              <Text type="label">Does it work?</Text>
              <SegmentedControl label="Does it work?" value={details.working == null ? 'unknown' : String(details.working)} onChange={v => set('working', v === 'unknown' ? null : v === 'true')}>
                <SegmentedControlItem value="true" label="Yes" />
                <SegmentedControlItem value="false" label="No" />
                <SegmentedControlItem value="unknown" label="Not sure" />
              </SegmentedControl>
            </VStack>
          </VStack>

          <VStack gap={3}>
            <Heading level={2}>Price</Heading>
            {value
              ? <Text as="p">Estimated value: ${value.amount}. {value.source.replace(/\.$/, '')}. This is an AI estimate and may not be accurate.</Text>
              : <Text as="p" color="secondary">Add photos and fill in details to get an AI estimate.</Text>}
            <NumberInput label="Your asking price, in dollars" min={0} value={details.askingPrice ?? null} onChange={v => set('askingPrice', v)} />
            <VStack gap={1}>
              <Text type="label">Listing</Text>
              <SegmentedControl label="Listing" value={details.listingStatus ?? 'not-listed'} onChange={v => set('listingStatus', v)}>
                {LISTING.map(([id, name]) => <SegmentedControlItem key={id} value={id} label={name} />)}
              </SegmentedControl>
            </VStack>
          </VStack>

          <VStack gap={3}>
            <Heading level={2}>Private</Heading>
            <Text as="p" color="secondary">These stay on this phone. They're never shared with Muse or put in a listing.</Text>
            <TextInput label="Purchase date" placeholder="2023-05-01" value={details.purchaseDate ?? ''} onChange={v => set('purchaseDate', v || null)} />
            <NumberInput label="Purchase price, in dollars" min={0} value={details.purchasePrice ?? null} onChange={v => set('purchasePrice', v)} />
            <TextInput label="Serial number" value={details.serialNumber ?? ''} onChange={v => set('serialNumber', v || null)} />
          </VStack>
        </>
      )}
    </VStack>
  )
}
