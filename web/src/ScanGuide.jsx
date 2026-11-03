import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import './Inventory.css'

/** Where to stand: one spot for an open room, one spot per part for an L-shaped Space. */
function Illustration() {
  const spot = (x, y) => (
    <g>
      <circle cx={x} cy={y} r="7" className="guide-spot" />
      <circle cx={x} cy={y} r="16" className="guide-turn" />
    </g>
  )
  return (
    <svg className="guide-art" viewBox="0 0 320 150" role="img" aria-label="An open room scanned from its middle, and an L-shaped Space scanned once from each part">
      <rect x="10" y="20" width="120" height="100" rx="4" className="guide-room" />
      {spot(70, 70)}
      <text x="70" y="142" className="guide-label" textAnchor="middle">Open room: 1 scan</text>
      <path d="M170 20 H310 V75 H230 V120 H170 Z" className="guide-room" />
      {spot(200, 50)}
      {spot(200, 98)}
      {spot(280, 48)}
      <text x="240" y="142" className="guide-label" textAnchor="middle">L-shaped: 1 per part</text>
    </svg>
  )
}

/** How to scan well, shown before scanning a Space and from the scanner's tips link. */
export default function ScanGuide({ isOpen, onClose }) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={open => { if (!open) onClose() }} width={440}>
      <Layout
        header={<DialogHeader title="How to scan a Space" onOpenChange={open => { if (!open) onClose() }} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Illustration />
              <Text as="p">Stand in the middle of the open area and turn slowly all the way around.</Text>
              <Text as="p">If you can't see the whole Space from one spot, like an L-shaped backyard or an open-plan room, scan once from each part. You'll be asked after each scan.</Text>
              <Text as="p">For hidden spots, like behind a shed or inside a closet, add photos instead. Good light helps.</Text>
              <Button label="Got it" variant="primary" onClick={onClose} />
            </VStack>
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
