import { useState } from 'react'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { useToast } from '@astryxdesign/core/Toast'
import { VStack } from '@astryxdesign/core/VStack'
import PersonForm from './PersonForm.jsx'
import { phoneNumber } from './phone.js'
import './Inventory.css'

// The Contact Picker works in Chrome on Android. Safari has it behind a setting; computers don't have it.
const canImport = () => typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function'

const newId = () => crypto.randomUUID()
const spaceNames = (person, spaces) => spaces.filter(s => person.spaceIds?.includes(s.id)).map(s => s.spaceName)

/** People who share these Spaces. They're added by hand or from contacts, never found in a scan. */
export default function People({ people, spaces, onChange, onBack }) {
  const toast = useToast()
  const [editing, setEditing] = useState(null) // a person, or 'new'
  const [importProblem, setImportProblem] = useState(null)

  async function importContacts() {
    setImportProblem(null)
    try {
      const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true })
      const known = new Set(people.map(p => `${p.name.toLowerCase()}|${p.phone}`))
      const added = picked
        .map(c => ({ name: (c.name?.[0] ?? '').trim().slice(0, 40), phone: c.tel?.map(phoneNumber).find(Boolean) ?? '' })) // the first number in full international form
        .filter(c => c.name && !known.has(`${c.name.toLowerCase()}|${c.phone}`))
        .map(c => ({ id: newId(), ...c, relationship: '', spaceIds: [] }))
      if (!added.length) return
      onChange([...people, ...added])
      toast({ body: `Added ${added.length === 1 ? added[0].name : `${added.length} people`}. Tap someone to add how they're related.`, autoHideDuration: 4000 })
    } catch {
      setImportProblem("Couldn't open your contacts. Add people by hand instead.")
    }
  }

  // Adding or editing someone is its own page; Back, saving or removing returns to the list.
  if (editing) {
    return (
      <PersonForm
        person={editing === 'new' ? null : editing}
        spaces={spaces}
        onClose={() => setEditing(null)}
        onSave={fields => {
          onChange(editing === 'new' ? [...people, { id: newId(), ...fields }] : people.map(p => (p.id === editing.id ? { ...p, ...fields } : p)))
          setEditing(null)
        }}
        onRemove={() => {
          onChange(people.filter(p => p.id !== editing.id))
          toast({ body: `Removed ${editing.name}`, autoHideDuration: 3000 })
          setEditing(null)
        }}
      />
    )
  }

  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack><IconButton label="Back" icon={<Icon icon="chevronLeft" />} onClick={onBack} /></HStack>
      <VStack gap={1}>
        <Heading level={1}>People</Heading>
        <Text as="p" color="secondary">The people you live with. They can vote on what to keep, sell or let go. Saved on this phone only.</Text>
      </VStack>

      {people.length > 0
        ? (
          <List hasDividers edge="flush">
            {people.map(person => (
              <ListItem
                key={person.id}
                label={person.name}
                description={[person.relationship, spaceNames(person, spaces).join(', ')].filter(Boolean).join(' · ') || 'Tap to add details'}
                startContent={<Avatar name={person.name} size="md" />}
                onClick={() => setEditing(person)}
              />
            ))}
          </List>
        )
        : <Text as="p" color="secondary">No one yet.</Text>}

      <VStack gap={2}>
        <Button label="Add a person" variant="primary" onClick={() => setEditing('new')} />
        {canImport()
          ? <Button label="Import from contacts" onClick={importContacts} />
          : (
            <Text as="p" type="supporting" color="secondary">
              Importing from contacts works in Chrome on Android. On iPhone, turn on Safari's Contact Picker API under Settings, Apps, Safari, Advanced, Feature Flags, then open Spaces in Safari.
            </Text>
          )}
        {importProblem && <Text as="p" role="alert">{importProblem}</Text>}
      </VStack>

    </VStack>
  )
}
