import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { decisionLabel, decisionOf } from './itemFields.js'
import { ShareVoteLink } from './VoteSetup.jsx'
import { VOTE_CHOICES, tally, tallyLine, topPick, turnout, voteDay } from './votes.js'
import './Inventory.css'

const choiceLabel = choice => VOTE_CHOICES.find(([id]) => id === choice)?.[1]

/**
 * A Space's family vote, on one screen. While it's open: the votes so far, sending the link again, and
 * one button that ends the vote and uses the family's top picks. After: what each item got, which
 * picks were used (each can be undone), and starting a new vote.
 */
export default function VoteReview({ space, people, results, onEnd, onUse, onUndo, onNewVote, onOpenItem, onBack }) {
  const [ending, setEnding] = useState(false)
  const [problem, setProblem] = useState(null)
  const link = space.voteLink
  const ended = Boolean(link.final)
  const applied = link.final?.applied ?? {}
  const { voted, waiting } = turnout(space, results)
  const entries = link.itemIds
    .map(id => space.result?.items.find(i => i.id === id))
    .filter(Boolean)
    .map(item => {
      const counts = tally(space, results, item.id)
      return { item, counts, pick: topPick(counts), current: decisionOf(item.status) }
    })

  async function end() {
    setEnding(true)
    setProblem(null)
    try { await onEnd() } catch (err) { setProblem(`Couldn't end the vote. ${err.message}`) } finally { setEnding(false) }
  }

  const status = ({ item, pick, counts, current }) => {
    if (!ended) return counts?.length ? tallyLine(counts) : 'No votes yet'
    const top = pick ? `Top pick: ${choiceLabel(pick)}` : counts?.length ? 'Tie' : 'No votes'
    const yours = String(item.id) in applied && current === pick ? 'family\'s pick used' : current ? `You: ${decisionLabel(current)}` : null
    return [top, yours].filter(Boolean).join(' · ')
  }
  const action = ({ item, pick, current }) => {
    if (!ended) return null
    const label = String(item.id) in applied && current === pick ? 'Undo' : pick && pick !== current ? `Use ${choiceLabel(pick)}` : null
    if (!label) return null
    return <Button label={label} aria-label={`${label}: ${item.name}`} variant="ghost" onClick={() => (label === 'Undo' ? onUndo(item.id) : onUse(item.id, pick))} />
  }

  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack><IconButton label={space.spaceName} icon={<Icon icon="chevronLeft" />} onClick={onBack} /></HStack>
      <VStack gap={1}>
        <Heading level={1}>{ended ? 'Family vote results' : 'Family vote'}</Heading>
        <Text as="p" color="secondary">
          {ended
            ? `Ended ${voteDay(link.final.endedAt)}${waiting.length ? ` · ${waiting.join(', ')} didn't vote` : ''}`
            : `Open until ${voteDay(link.expiresAt)} · ${voted.length} of ${link.voters.length} voted${waiting.length ? ` · waiting for ${waiting.join(', ')}` : ''}`}
        </Text>
      </VStack>

      <List hasDividers edge="flush">
        {entries.map(entry => (
          <ListItem
            key={entry.item.id}
            align="start"
            label={<Text as="p">{entry.item.name}</Text>}
            onClick={() => onOpenItem(entry.item.id)}
            description={(
              <VStack gap={1}>
                <Text as="p" type="label">{status(entry)}</Text>
                {ended && entry.counts?.length > 0 && <Text as="p" type="supporting">{tallyLine(entry.counts)}</Text>}
              </VStack>
            )}
            startContent={entry.item.picture ? <img className="inventory-crop" src={entry.item.picture} alt="" /> : <span className="inventory-crop" />}
            endContent={action(entry)}
          />
        ))}
      </List>

      {!ended && (
        <VStack gap={3}>
          <ShareVoteLink space={space} people={people} primary={false} />
          <VStack gap={1}>
            <Button label="End vote and use top picks" variant="primary" isLoading={ending} onClick={end} />
            <Text as="p" type="supporting" color="secondary" justify="center">
              Voting closes and the link is deleted. Items you haven't decided get the family's top pick; ties and your own decisions stay. You can undo each one.
            </Text>
          </VStack>
          {problem && <Text as="p" role="alert">{problem}</Text>}
        </VStack>
      )}
      {ended && (
        <VStack gap={1}>
          <Button label="Start a new vote" onClick={onNewVote} />
          <Text as="p" type="supporting" color="secondary" justify="center">A new vote replaces these results.</Text>
        </VStack>
      )}
    </VStack>
  )
}
