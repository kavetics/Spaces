import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { List, ListItem } from '@astryxdesign/core/List'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { LISTING, decisionOf } from './itemFields.js'
import { sortItems } from './spaceItems.js'
import './Inventory.css'

const ALL = 'all'
const listingRank = status => ({ draft: 1, listed: 2, sold: 3 })[status] ?? 0 // not listed first: it needs the most work
const listingLabel = status => LISTING.find(([id]) => id === (status ?? 'not-listed'))?.[1]
const money = n => `$${n.toLocaleString()}`

/** Everything marked Sell or Let go, across Spaces, as { space, item } in each list. Plain code sorts and counts. */
export function sellingLists(spaces, spaceId = ALL) {
  const entries = spaces
    .filter(s => s.result && (spaceId === ALL || s.id === spaceId))
    .flatMap(space => sortItems(space).inSpace.map(item => ({ space, item })))
  const selling = entries.filter(e => decisionOf(e.item.status) === 'sell')
  const lettingGo = entries.filter(e => decisionOf(e.item.status) === 'donate')
  const status = e => e.item.details?.listingStatus
  const price = e => e.item.details?.askingPrice ?? 0
  return {
    toSell: selling.filter(e => status(e) !== 'sold').sort((a, b) => listingRank(status(a)) - listingRank(status(b))),
    sold: selling.filter(e => status(e) === 'sold'),
    toLetGo: lettingGo.filter(e => !e.item.goneAt),
    gone: lettingGo.filter(e => e.item.goneAt),
    asking: selling.filter(e => status(e) !== 'sold').reduce((sum, e) => sum + price(e), 0),
    soldFor: selling.filter(e => status(e) === 'sold').reduce((sum, e) => sum + price(e), 0),
  }
}

/** The button that opens the page: how many are left, shown once anything is marked Sell or Let go. */
export function sellingButton(spaces) {
  const { toSell, toLetGo, sold, gone } = sellingLists(spaces)
  const left = toSell.length + toLetGo.length
  if (!left && !sold.length && !gone.length) return null
  return left ? `For sale & letting go · ${left}` : 'For sale & letting go'
}

/**
 * What's for sale and what's going, so selling and giving away can be worked through like a list.
 * Items across all Spaces, with a Space filter. Marking an item gone moves it to Done.
 */
export default function Selling({ spaces, spaceId, tab, onSpace, onTab, familyVotes, onOpenItem, onGone, onBack }) {
  const lists = sellingLists(spaces, spaceId)
  const ready = spaces.filter(s => s.result)
  const showSpace = spaceId === ALL && ready.length > 1

  const row = ({ space, item }, details, sideAction) => {
    const votes = familyVotes(space, item.id)
    return (
      <ListItem
        key={`${space.id}-${item.id}`}
        align="start"
        label={<Text as="p">{item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name}</Text>}
        onClick={() => onOpenItem(space.id, item.id)}
        description={(
          <VStack gap={1}>
            <Text as="p" type="label">{[showSpace && space.spaceName, ...details].filter(Boolean).join(' · ')}</Text>
            {votes && <Text as="p" type="supporting">Family votes: {votes}</Text>}
          </VStack>
        )}
        startContent={item.picture ? <img className="inventory-crop" src={item.picture} alt="" /> : <span className="inventory-crop" />}
        endContent={sideAction}
      />
    )
  }
  const sellDetails = ({ item }) => [
    item.details?.askingPrice ? money(item.details.askingPrice) : 'No price yet',
    listingLabel(item.details?.listingStatus),
    item.salePhotos?.length ? null : 'needs photos',
  ]
  const goneButton = ({ space, item }, gone) => (
    <Button label={gone ? 'Undo' : 'Mark gone'} aria-label={`${gone ? 'Undo' : 'Mark gone'}: ${item.name}`} variant="ghost" onClick={() => onGone(space.id, item.id, !gone)} />
  )
  const list = (entries, render) => <List hasDividers edge="flush">{entries.map(render)}</List>

  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack><IconButton label="Back" icon={<Icon icon="chevronLeft" />} onClick={onBack} /></HStack>
      <VStack gap={3}>
        <Heading level={1}>For sale & letting go</Heading>
        {ready.length > 1 && (
          <Selector
            label="Space"
            options={[{ value: ALL, label: 'All Spaces' }, ...ready.map(s => ({ value: s.id, label: s.spaceName }))]}
            value={spaceId}
            onChange={onSpace}
          />
        )}
        <SegmentedControl label="List" layout="fill" value={tab} onChange={onTab}>
          <SegmentedControlItem value="sell" label={`To sell (${lists.toSell.length})`} />
          <SegmentedControlItem value="go" label={`To let go (${lists.toLetGo.length})`} />
        </SegmentedControl>
      </VStack>

      {tab === 'sell' && (
        <VStack gap={4}>
          <Text as="p" color="secondary">
            {[lists.asking ? `Asking ${money(lists.asking)}` : null, lists.soldFor ? `Sold ${money(lists.soldFor)} so far` : null].filter(Boolean).join(' · ') || 'Set asking prices on items to see a total.'}
          </Text>
          {lists.toSell.length
            ? list(lists.toSell, e => row(e, sellDetails(e)))
            : <Text as="p" color="secondary">Nothing to sell{lists.sold.length ? ' right now. Nice work.' : '. Mark items Sell in a Space or while decluttering.'}</Text>}
          {lists.sold.length > 0 && (
            <Collapsible defaultIsOpen={false} trigger={<Heading level={2}>Sold ({lists.sold.length})</Heading>}>
              {list(lists.sold, e => row(e, [e.item.details?.askingPrice ? money(e.item.details.askingPrice) : null]))}
            </Collapsible>
          )}
        </VStack>
      )}

      {tab === 'go' && (
        <VStack gap={4}>
          <Text as="p" color="secondary">Donate, give away or throw out. Mark each one gone when it's out of the house.</Text>
          {lists.toLetGo.length
            ? list(lists.toLetGo, e => row(e, [], goneButton(e, false)))
            : <Text as="p" color="secondary">Nothing to let go{lists.gone.length ? ' right now. Nice work.' : '. Mark items Let go in a Space or while decluttering.'}</Text>}
          {lists.gone.length > 0 && (
            <Collapsible defaultIsOpen={false} trigger={<Heading level={2}>Done ({lists.gone.length})</Heading>}>
              {list(lists.gone, e => row(e, [], goneButton(e, true)))}
            </Collapsible>
          )}
        </VStack>
      )}
    </VStack>
  )
}
