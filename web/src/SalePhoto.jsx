import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { VStack } from '@astryxdesign/core/VStack'
import './Inventory.css'

export default function SalePhoto({ blob, onRemove }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    const made = URL.createObjectURL(blob)
    setUrl(made)
    return () => URL.revokeObjectURL(made)
  }, [blob])
  return (
    <VStack gap={1} hAlign="center">
      {url && <img className="item-sale-photo" src={url} alt="Photo for selling" />}
      <Button label="Remove" variant="ghost" size="sm" onClick={onRemove} />
    </VStack>
  )
}
