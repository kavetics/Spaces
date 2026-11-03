import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { DECISIONS, byYou, decisionOf } from './itemFields.js'
import ItemForm from './ItemForm.jsx'
import SellForm from './SellForm.jsx'
import { categoryOf, CATEGORIES } from './spaceItems.js'
import './Inventory.css'

/** One thing: what it is, its decision (with the family's votes), and when it's for sale, what a listing needs. */
export default function ItemDetail({ space, item, onChange, onBack, onSave, backLabel, autoDraft, familyVotes, inOpenVote, onAskFamily }) {
  const [editing, setEditing] = useState(false)
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
        <Heading level={2}>Decision</Heading>
        <SegmentedControl label="Decision" value={decisionOf(item.status) ?? ''} onChange={status => onChange({ status })}>
          {DECISIONS.map(([id, name]) => <SegmentedControlItem key={id} value={id} label={name} />)}
        </SegmentedControl>
        <VStack gap={1} hAlign="start">
          {/* While its vote is open, the vote screen on the Space is where it's sent, ended or replaced. */}
          {inOpenVote
            ? <Text type="label">In the family vote · {familyVotes}</Text>
            : (
              <>
                {familyVotes && <Text type="label">Family votes: {familyVotes}</Text>}
                <Button label="Ask family to vote" size="sm" onClick={onAskFamily} />
              </>
            )}
        </VStack>
      </VStack>

      {item.status === 'sell' && <SellForm item={item} onChange={onChange} autoDraft={autoDraft} />}

      {/* Changes are kept as they're made, so this only finishes; no "Save" that needs explaining. */}
      <Button label="Done" variant="primary" size="lg" onClick={onSave} />
    </VStack>
  )
}
