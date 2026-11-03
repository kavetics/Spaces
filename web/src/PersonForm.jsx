import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { phoneNumber, showPhone } from './phone.js'

const MAX_NAME = 40
const MAX_RELATIONSHIP = 30
const MAX_PHONE = 24 // as typed, with spaces and brackets

/**
 * Adds someone to the household, or changes them. Everything stays on this phone.
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
    <Dialog isOpen onOpenChange={open => { if (!open) onClose() }} purpose="form" width={440}>
      <Layout
        header={<DialogHeader title={person ? `Edit ${person.name}` : 'Add a person'} onOpenChange={open => { if (!open) onClose() }} />}
        content={
          <LayoutContent>
            <form onSubmit={e => { e.preventDefault(); save() }}>
              <VStack gap={3}>
                <TextInput label="Name" placeholder="Mom" autoComplete="off" value={name} onChange={v => setName(v.slice(0, MAX_NAME))} />
                <TextInput label="Relationship" placeholder="Mother, brother, roommate" isOptional value={relationship} onChange={v => setRelationship(v.slice(0, MAX_RELATIONSHIP))} />
                <TextInput
                  label="Phone"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+1 512 555 0101"
                  description={number ? `✓ Ready for WhatsApp: ${showPhone(number)}` : 'Include the country code. US numbers can skip +1.'}
                  status={triedSave && number === null ? { type: 'error', message: 'Enter the full number with its country code, like +1 512 555 0101 or +91 98765 43210.' } : undefined}
                  isOptional
                  value={phone}
                  onChange={v => setPhone(v.slice(0, MAX_PHONE))}
                />
                {spaces.length > 0 && (
                  <CheckboxList label="Spaces they use" description="Optional." value={spaceIds} onChange={setSpaceIds}>
                    {spaces.map(s => <CheckboxListItem key={s.id} value={s.id} label={s.spaceName} />)}
                  </CheckboxList>
                )}
                <Button label={person ? 'Save changes' : 'Add person'} type="submit" variant="primary" isDisabled={!ready} />
                {person && <Button label={`Remove ${person.name}`} variant="destructive" onClick={onRemove} />}
              </VStack>
            </form>
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
