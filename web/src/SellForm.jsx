import { useRef, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { describeForSale, shrinkPhoto } from './api.js'
import { CONDITIONS, LISTING, editDetail, mergeAiDetails } from './itemFields.js'
import ListingDraft from './ListingDraft.jsx'
import SalePhoto from './SalePhoto.jsx'
import './Inventory.css'

const MAX_SALE_PHOTOS = 6
const list = text => text.split(',').map(s => s.trim()).filter(Boolean)

/**
 * What selling an item needs, in the order Marketplace asks: photos, a price, the condition and a listing.
 * Everything else is optional, under More details.
 */
export default function SellForm({ item, onChange, autoDraft }) {
  const details = item.details ?? {}
  const ai = new Set(details.aiFields ?? [])
  const salePhotos = item.salePhotos ?? []
  const [filling, setFilling] = useState(false)
  const [fillError, setFillError] = useState(null)
  const fileInput = useRef(null)

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
    <>
      <VStack gap={2}>
        <Heading level={2}>Photos for selling</Heading>
        <Text as="p" color="secondary">2 to 4 photos: front, back, any label, any damage. They stay on this phone.</Text>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
        {salePhotos.length > 0 && (
          <Grid columns={3} gap={2}>
            {salePhotos.map((blob, i) => <SalePhoto key={i} blob={blob} onRemove={() => onChange({ salePhotos: salePhotos.filter((_, n) => n !== i) })} />)}
          </Grid>
        )}
        <HStack gap={2}>
          {salePhotos.length < MAX_SALE_PHOTOS && <Button label="Add photos" onClick={() => fileInput.current?.click()} />}
          <Button label="Fill in details with AI" variant="primary" isDisabled={!salePhotos.length} isLoading={filling} onClick={fillFromPhotos} />
        </HStack>
        {!salePhotos.length && <Text as="p" type="supporting" color="secondary">Add a photo first, then AI can fill in the details.</Text>}
        {fillError &&<Text as="p" role="alert">{fillError}</Text>}
      </VStack>

      {ai.size > 0 && <Banner status="info" title="Some details are from AI and may not be accurate." description="Check the ones marked AI estimate, including under More details. Changing a field makes it yours." />}

      <VStack gap={3}>
        <Heading level={2}>Price and condition</Heading>
        {value
          ? <Text as="p">Estimated value: ${value.amount}. {value.source.replace(/\.$/, '')}. This is an AI estimate and may not be accurate.</Text>
          : <Text as="p" color="secondary">Add photos and fill in details to get an AI estimate.</Text>}
        <NumberInput label="Your asking price, in dollars" min={0} value={details.askingPrice ?? null} onChange={v => set('askingPrice', v)} />
        <VStack gap={1}>
          <Text type="label">{label('Condition', 'condition')}</Text>
          <SegmentedControl label="Condition" layout="fill" value={details.condition ?? ''} onChange={v => set('condition', v)}>
            {CONDITIONS.map(([id, name]) => <SegmentedControlItem key={id} value={id} label={name} />)}
          </SegmentedControl>
        </VStack>
        <VStack gap={1}>
          <Text type="label">Listing</Text>
          <SegmentedControl label="Listing" layout="fill" value={details.listingStatus ?? 'not-listed'} onChange={v => set('listingStatus', v)}>
            {LISTING.map(([id, name]) => <SegmentedControlItem key={id} value={id} label={name} />)}
          </SegmentedControl>
        </VStack>
      </VStack>

      <ListingDraft item={item} onChange={onChange} autoDraft={autoDraft} />

      {/* Optional: Marketplace needs only photos, a title, a price and the condition. These make Muse's listing and answers better. */}
      <Collapsible defaultIsOpen={false} trigger={<Heading level={2}>More details</Heading>}>
        <VStack gap={3}>
          <Text as="p" color="secondary">Optional. Muse uses these for the listing and your questions. Fill in details with AI fills most of them.</Text>
          <TextInput label={label('Brand', 'brand')} value={details.brand ?? ''} onChange={v => set('brand', v || null)} />
          <TextInput label={label('Model', 'model')} value={details.model ?? ''} onChange={v => set('model', v || null)} />
          <TextInput label={label('Size', 'size')} placeholder="55-inch, 3-seat" value={details.size ?? ''} onChange={v => set('size', v || null)} />
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
      </Collapsible>
    </>
  )
}
