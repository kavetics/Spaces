import { useRef, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack } from '@astryxdesign/core/HStack'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { pictureOf } from './crop.js'
import { CATEGORIES, categoryOf } from './spaceItems.js'
import './Inventory.css'

const OPTIONS = CATEGORIES.map(([value, label]) => ({ value, label }))
const MAX_NAME = 80

/**
 * Fixes an item's name, category and quantity, or adds an item the scan missed.
 * Adding can include a photo, saved as the item's picture. onSave({ name, category, quantity, picture? })
 */
export default function ItemForm({ item, spaceName, onSave, onClose }) {
  const adding = !item
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item ? categoryOf(item) : 'other')
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [picture, setPicture] = useState(null)
  const [photoProblem, setPhotoProblem] = useState(null)
  const fileInput = useRef(null)
  const ready = name.trim().length > 0

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoProblem(null)
    try { setPicture(await pictureOf(file)) } catch { setPhotoProblem("Couldn't read that photo. Try another one.") }
  }

  function save() {
    if (!ready) return
    // Plain code keeps what's stored sensible: a short name, a known category, a whole number of at least 1.
    const count = Math.max(1, Math.round(Number(quantity) || 1))
    onSave({ name: name.trim().slice(0, MAX_NAME), category, quantity: count, ...(picture && { picture }) })
  }

  return (
    <Dialog isOpen onOpenChange={open => { if (!open) onClose() }} purpose="form" width={440}>
      <Layout
        header={<DialogHeader title={adding ? `Add an item to ${spaceName}` : 'Edit item'} onOpenChange={open => { if (!open) onClose() }} />}
        content={
          <LayoutContent>
            <form onSubmit={e => { e.preventDefault(); save() }}>
              <VStack gap={3}>
                {adding && <Text as="p" color="secondary">For things the scan missed, like what's inside a closet.</Text>}
                <TextInput label="Name" placeholder="Blue armchair" value={name} onChange={v => setName(v.slice(0, MAX_NAME))} />
                <Selector label="Category" options={OPTIONS} value={category} onChange={setCategory} />
                <NumberInput label="How many" min={1} value={quantity} onChange={setQuantity} />
                {adding && (
                  <VStack gap={2}>
                    <input ref={fileInput} type="file" accept="image/*" hidden onChange={choosePhoto} />
                    {picture && <img className="item-photo" src={picture} alt="Your photo of this item" />}
                    <HStack gap={2}>
                      <Button label={picture ? 'Change photo' : 'Add a photo'} onClick={() => fileInput.current?.click()} />
                      {picture && <Button label="Remove photo" variant="ghost" onClick={() => setPicture(null)} />}
                    </HStack>
                    {photoProblem && <Text as="p" role="alert">{photoProblem}</Text>}
                  </VStack>
                )}
                <Button label={adding ? 'Add item' : 'Save changes'} type="submit" variant="primary" isDisabled={!ready} />
              </VStack>
            </form>
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
