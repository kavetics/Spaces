import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { phoneNumber, showPhone } from './phone.js'

const MAX_NAME = 40
const MAX_RELATIONSHIP = 30
const MAX_PHONE = 24 // as typed, with spaces and brackets

/**
 * Adds someone to the household, or changes them. Everything stays on this phone.
 * iPhone Safari drew the Phone field's cursor a line too low, in a pop-up and in a fixed scrolling page alike.
 * So this page scrolls the document itself, and the phone hint sits under the field instead of above it.
 * onSave({ name, relationship, phone, spaceIds }); onRemove only when editing.
 */
export default function PersonForm({ person, spaces, onSave, onRemove, onClose }) {
  const [name, setName] = useState(person?.name ?? '')
  const [relationship, setRelationship] = useState(person?.relationship ?? '')
  const [phone, setPhone] = useState(showPhone(person?.phone))
  const [spaceIds, setSpaceIds] = useState(person?.spaceIds ?? [])
  const [triedSave, setTriedSave] = useState(false)
  const number = phoneNumber(phone)
  const ready = name.trim().length > 0
  useEffect(() => { window.scrollTo(0, 0) }, [])

  function save() {
    setTriedSave(true)
    if (!ready || number === null) return
    // Plain code keeps what's stored sensible: trimmed text, a full international phone number, and only real Spaces.
    onSave({
      name: name.trim().slice(0, MAX_NAME),
      relationship: relationship.trim().slice(0, MAX_RELATIONSHIP),
      phone: number,
      spaceIds: spaceIds.filter(id => spaces.some(s => s.id === id)),
    })
  }

  return (
    <VStack gap={5} padding={4} className="page">
      <HStack><IconButton label="Back" icon={<Icon icon="chevronLeft" />} onClick={onClose} /></HStack>
      <Heading level={1}>{person ? `Edit ${person.name}` : 'Add a person'}</Heading>
      <form onSubmit={e => { e.preventDefault(); save() }}>
        <VStack gap={3}>
          <TextInput label="Name" placeholder="Mom" autoComplete="off" value={name} onChange={v => setName(v.slice(0, MAX_NAME))} />
          <TextInput label="Relationship" placeholder="Mother, brother, roommate" isOptional value={relationship} onChange={v => setRelationship(v.slice(0, MAX_RELATIONSHIP))} />
          <VStack gap={1}>
            <TextInput
              label="Phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 512 555 0101"
              status={triedSave && number === null ? { type: 'error', message: 'Enter the full number with its country code, like +1 512 555 0101 or +91 98765 43210.' } : undefined}
              isOptional
              value={phone}
              onChange={v => setPhone(v.slice(0, MAX_PHONE))}
            />
            {!(triedSave && number === null) && <Text as="p" type="supporting" color="secondary">{number ?`✓ Ready for WhatsApp: ${showPhone(number)}` : 'Include the country code. US numbers can skip +1.'}</Text>}
          </VStack>
          {spaces.length > 0 && (
            <CheckboxList label="Spaces they use" description="Optional." value={spaceIds} onChange={setSpaceIds}>
              {spaces.map(s => <CheckboxListItem key={s.id} value={s.id} label={s.spaceName} />)}
            </CheckboxList>
          )}
          <Button label={person ? 'Save changes' : 'Add person'} type="submit" variant="primary" isDisabled={!ready} />
          {person && <Button label={`Remove ${person.name}`} variant="destructive" onClick={onRemove} />}
        </VStack>
      </form>
    </VStack>
  )
}
