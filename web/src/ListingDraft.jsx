import { useEffect, useRef, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { draftListing } from './api.js'
import { editDetail, listingFields, listingText } from './itemFields.js'
import { shareItem, useSharePhoto } from './share.js'

const MAX_TITLE = 80

/**
 * A listing Muse drafts from the item's details, for the person to check, edit and copy. Nothing is
 * posted. With autoDraft (opened from Ask Muse), it drafts right away and comes into view.
 */
export default function ListingDraft({ item, onChange, autoDraft }) {
  const draft = item.listingDraft
  const details = item.details ?? {}
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)
  const section = useRef(null)
  const photo = useSharePhoto(item)
  const started = useRef(false)

  async function makeDraft() {
    setDrafting(true)
    setError(null)
    setCopied(null)
    try {
      const { listing } = await draftListing(listingFields(item))
      const listed = details.listingStatus && details.listingStatus !== 'not-listed'
      onChange({
        listingDraft: { ...listing, draftedAt: new Date().toISOString() },
        ...(!listed && { details: editDetail(details, 'listingStatus', 'draft') }),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setDrafting(false)
    }
  }

  useEffect(() => {
    if (!autoDraft || started.current) return
    started.current = true
    section.current?.scrollIntoView?.({ block: 'start' })
    if (!draft) makeDraft()
    // Runs once, when opened from Ask Muse.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDraft])

  const edit = (key, value) => onChange({ listingDraft: { ...draft, [key]: value } })

  // The text is copied first too: some apps keep only the photo from a share, so it can be pasted.
  // Both start right away, inside the tap, which iPhones require for each.
  async function share() {
    const text = listingText(draft, details.askingPrice)
    const copying = navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false)
    const how = await shareItem(photo, text)
    const copiedToo = await copying
    if (how === 'cancelled') return
    setCopied(`${how === 'whatsapp' ? 'Opened WhatsApp.' : 'Shared.'}${copiedToo ? ' The text is also copied, to paste into Marketplace.' : ''} Mark it Listed above once it's posted.`)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(listingText(draft, details.askingPrice))
      setCopied('Copied. Paste it into your listing.')
    } catch {
      setCopied("Couldn't copy. Select the text above and copy it.")
    }
  }

  const range = draft?.priceLow
    ? (draft.priceLow === draft.priceHigh ? `$${draft.priceLow}` : `$${draft.priceLow}–$${draft.priceHigh}`)
    : null

  return (
    <VStack gap={3} ref={section}>
      <Heading level={2}>Listing draft</Heading>
      {!draft && <Text as="p" color="secondary">Muse writes a title, description and price range from the details above. Nothing is posted.</Text>}
      {draft && (
        <>
          <Banner status="info" title="Drafted by Muse. Check it before posting." description="It only uses the details above, never your private ones." />
          <TextInput label="Title" value={draft.title} onChange={v => edit('title', v.slice(0, MAX_TITLE))} />
          <TextArea label="Description" value={draft.description} onChange={v => edit('description', v)} />
          <Text as="p">
            {range ? `Suggested price: ${range}. ${draft.priceBasis ? `${draft.priceBasis.replace(/\.$/, '')}. ` : ''}This is an AI estimate and may not be accurate.` : 'Muse could not suggest a price for this one.'}
          </Text>
          {!details.askingPrice && <Text as="p" color="secondary">Set your asking price above to include it when you copy.</Text>}
        </>
      )}
      <HStack gap={2}>
        {draft && <Button label="Share listing" variant="primary" onClick={share} />}
        {draft && <Button label="Copy" onClick={copy} />}
        <Button label={draft ? 'Draft again' : 'Draft a listing with Muse'} variant={draft ? 'secondary' : 'primary'} isLoading={drafting} onClick={makeDraft} />
      </HStack>
      {copied && <Text as="p" role="status">{copied}</Text>}
      {error && <Text as="p" role="alert">{error}</Text>}
    </VStack>
  )
}
