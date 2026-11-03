import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Text } from '@astryxdesign/core/Text'
import { useToast } from '@astryxdesign/core/Toast'
import { VStack } from '@astryxdesign/core/VStack'
import { DECISIONS, byYou, decisionOf } from './itemFields.js'
import ItemForm from './ItemForm.jsx'
import { familyQuestion, shareItem, useSharePhoto } from './share.js'
import SellForm from './SellForm.jsx'
import { categoryOf, CATEGORIES } from './spaceItems.js'
import './Inventory.css'

/** One item: its decision, and when it's for sale, the photos and details a listing needs. */
export default function ItemDetail({ space, item, onChange, onBack, onSave, backLabel, autoDraft }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [asked, setAsked] = useState(null)
  const photo = useSharePhoto(item)

  // Family replies in the chat app; the person records the decision here. Votes in the app come later.
  async function askFamily() {
    const how = await shareItem(photo, familyQuestion(item, space.spaceName))
    setAsked({ shared: 'Sent. Set the decision here once they reply.', whatsapp: 'Opened WhatsApp. Attach the photo there if you like.' }[how] ?? null)
  }
  const category = CATEGORIES.find(([id]) => id === categoryOf(item))?.[1]

  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack gap={2} vAlign="center" hAlign="between">
        <IconButton label={backLabel ?? space.spaceName} icon={<Icon icon="chevronLeft" />} onClick={onBack} />
        <Button label="Edit" size="sm" onClick={() => setEditing(true)} />
      </HStack>
      <VStack gap={3}>
        {item.picture && <img className="item-photo" src={item.picture} alt={item.name} />}
        <VStack gap={1}>
          <Heading level={1}>{item.name}</Heading>
          <Text color="secondary">{[space.spaceName, category, item.quantity > 1 ? `${item.quantity} of these` : null].filter(Boolean).join(' · ')}</Text>
          {byYou(item) && <Text type="label">{byYou(item)}</Text>}
          {item.description && <Text as="p">{item.description}</Text>}
        </VStack>
      </VStack>
      {editing && (
        <ItemForm
          item={item}
          spaceName={space.spaceName}
          onClose={() => setEditing(false)}
          onSave={fields => {
            const changed = ['name', 'category', 'quantity'].some(k => fields[k] !== (k === 'category' ? categoryOf(item) : item[k]))
            if (changed) onChange({ ...fields, editedByHand: !item.addedByHand })
            setEditing(false)
          }}
        />
      )}

      <VStack gap={2}>
        <Heading level={2}>What should happen to it?</Heading>
        <SegmentedControl label="Decision" value={decisionOf(item.status) ?? ''} onChange={status => onChange({ status })}>
          {DECISIONS.map(([id, name]) => <SegmentedControlItem key={id} value={id} label={name} />)}
        </SegmentedControl>
        <VStack gap={1} hAlign="start">
          <Button label="Ask family" size="sm" onClick={askFamily} />
          <Text type="supporting" color="secondary">{asked ?? 'Send its photo on WhatsApp or Messages for a vote.'}</Text>
        </VStack>
      </VStack>

      {item.status === 'sell' && <SellForm item={item} onChange={onChange} autoDraft={autoDraft} />}

      <VStack gap={2}>
        <Button label="Save" variant="primary" size="lg" onClick={() => { toast({ body: `Saved ${item.name}`, autoHideDuration: 3000 }); onSave() }} />
        <Text as="p" color="secondary" justify="center">Changes are kept as you go. Save takes you back to your inventory.</Text>
      </VStack>
    </VStack>
  )
}
