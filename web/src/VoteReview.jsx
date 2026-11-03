import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { decisionLabel, decisionOf } from './itemFields.js'
import { VOTE_CHOICES, tally, tallyLine, topPick } from './votes.js'
import './Inventory.css'

const choiceLabel = choice => VOTE_CHOICES.find(([id]) => id === choice)?.[1]

/**
 * The family's votes, item by item, with their top pick ready to use. Votes are advice: nothing changes
 * until the owner taps. "Use all" only fills in undecided items with a clear winner; ties and items
 * already decided are left alone.
 */
export default function VoteReview({ space, results, onDecide, onOpenItem, onBack }) {
  const entries = space.voteLink.itemIds
    .map(id => space.result?.items.find(i => i.id === id))
    .filter(Boolean)
    .map(item => {
      const counts = tally(space, results, item.id)
      return { item, counts, pick: topPick(counts), current: decisionOf(item.status) }
    })
  const ready = entries.filter(e => e.pick && !e.current)

  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack><IconButton label={space.spaceName} icon={<Icon icon="chevronLeft" />} onClick={onBack} /></HStack>
      <VStack gap={1}>
        <Heading level={1}>Family vote results</Heading>
        <Text as="p" color="secondary">Their top pick for each item. Nothing changes until you choose.</Text>
      </VStack>
      {ready.length > 0 && (
        <VStack gap={1}>
          <Button label={`Use all top picks (${ready.length})`} variant="primary" size="lg" onClick={() => ready.forEach(e => onDecide(e.item.id, e.pick))} />
          <Text as="p" type="supporting" color="secondary" justify="center">Only for items you haven't decided. Ties are left for you.</Text>
        </VStack>
      )}
      <List hasDividers edge="flush">
        {entries.map(({ item, counts, pick, current }) => (
          <ListItem
            key={item.id}
            align="start"
            label={<Text as="p">{item.name}</Text>}
            onClick={() => onOpenItem(item.id)}
            description={(
              <VStack gap={1}>
                <Text as="p" type="label">{pick ? `Top pick: ${choiceLabel(pick)}` : counts?.length ? 'Tie' : 'No votes'}{current ? ` · You: ${decisionLabel(current)}` : ''}</Text>
                {counts?.length > 0 && <Text as="p" type="supporting">{tallyLine(counts)}</Text>}
              </VStack>
            )}
            startContent={item.picture ? <img className="inventory-crop" src={item.picture} alt="" /> : <span className="inventory-crop" />}
            endContent={pick && pick !== current
              ? <Button label={`Use ${choiceLabel(pick)}`} aria-label={`Use ${choiceLabel(pick)}: ${item.name}`} size="sm" variant="ghost" onClick={() => onDecide(item.id, pick)} />
              : null}
          />
        ))}
      </List>
    </VStack>
  )
}
