import { useState } from 'react'
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

/** Names the Space before scanning, so what's in it can be told apart from what's nearby. */
export default function SpacePicker({ initial = '', onPick, onBack }) {
  const [name, setName] = useState(SUGGESTIONS.includes(initial) ? '' : initial)
  const typed = name.trim()
  return (
    <Center className="inventory-center" padding={6}>
      <VStack gap={6} className="space-picker">
        <VStack gap={1}>
          <Heading level={1}>What are you scanning?</Heading>
          <Text as="p" color="secondary">We'll keep this Space's items separate from anything nearby.</Text>
        </VStack>
        <VStack gap={2}>
          {SUGGESTIONS.map(s => <Button key={s} label={s} size="lg" onClick={() => onPick(s)} />)}
        </VStack>
        <VStack gap={2}>
          <TextInput label="Or name your own" placeholder="Home office" value={name} onChange={v => setName(v.slice(0, MAX_NAME))} />
          <HStack gap={2} hAlign="between">
            <Button label="Back" variant="ghost" onClick={onBack} />
            <Button label="Continue" variant="primary" isDisabled={!typed} onClick={() => onPick(typed)} />
          </HStack>
        </VStack>
      </VStack>
    </Center>
  )
}
