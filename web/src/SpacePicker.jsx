import { useState } from 'react'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import './Inventory.css'

const SUGGESTIONS = ['Living room', 'Bedroom', 'Kitchen', 'Garage', 'Backyard']
const MAX_NAME = 40
const same = (a, b) => a.toLowerCase() === b.toLowerCase()

/** Names the Space before scanning, so what's in it can be told apart from what's nearby. */
export default function SpacePicker({ usedNames = [], onPick, onBack }) {
  const [name, setName] = useState('')
  const [askRescan, setAskRescan] = useState(null)
  const typed = name.trim()
  const open = SUGGESTIONS.filter(s => !usedNames.some(used => same(used, s)))

  function pickTyped() {
    const existing = usedNames.find(used => same(used, typed))
    if (existing) setAskRescan(existing)
    else onPick(typed)
  }

  return (
    <Center className="inventory-center" padding={6}>
      <VStack gap={6} className="space-picker">
        <VStack gap={1}>
          <Heading level={1}>What are you scanning?</Heading>
          <Text as="p" color="secondary">We'll keep this Space's items separate from anything nearby.</Text>
        </VStack>
        {open.length > 0 && (
          <VStack gap={2}>
            {open.map(s => <Button key={s} label={s} onClick={() => onPick(s)} />)}
          </VStack>
        )}
        <VStack gap={2}>
          <TextInput label={open.length ? 'Or name your own' : 'Name your Space'} placeholder="Home office" value={name} onChange={v => setName(v.slice(0, MAX_NAME))} />
          <HStack gap={2} hAlign="between">
            <Button label="Back" variant="ghost" onClick={onBack} />
            <Button label="Continue" variant="primary" isDisabled={!typed} onClick={pickTyped} />
          </HStack>
        </VStack>
      </VStack>
      <AlertDialog
        isOpen={Boolean(askRescan)}
        onOpenChange={() => setAskRescan(null)}
        title={`You already have a ${askRescan}`}
        description="Rescanning replaces its photos and item list once the new scan is taken."
        actionLabel="Rescan it"
        actionVariant="primary"
        onAction={() => onPick(askRescan)}
      />
    </Center>
  )
}
