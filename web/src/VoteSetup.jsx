import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { createVoteLink } from './api.js'
import { phoneNumber } from './phone.js'
import { shareItem } from './share.js'
import { sortItems } from './spaceItems.js'
import { MAX_VOTE_ITEMS, linkPayload, turnout, voteDay, voteMessage, voteUrl } from './votes.js'
import './Inventory.css'

const whatsappTo = (phone, text) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
// Numbers saved before the format check may lack a country code; only full numbers get a button.
const fullNumber = person => phoneNumber(person.phone)

/** Sending the link: the share sheet, WhatsApp straight to someone with a saved number, or copying it. */
export function ShareVoteLink({ space, people, primary = true }) {
  const [status, setStatus] = useState(null)
  const link = space.voteLink
  const message = voteMessage(space, link.id)
  const withPhones = people.filter(p => fullNumber(p) && link.voters.some(v => v.id === p.id))

  async function share() {
    const how = await shareItem(null, message)
    if (how !== 'cancelled') setStatus(how === 'whatsapp' ? 'Opened WhatsApp.' : 'Shared.')
  }
  async function copy() {
    try { await navigator.clipboard.writeText(voteUrl(link.id)); setStatus('Link copied.') } catch { setStatus(`Couldn't copy. The link is ${voteUrl(link.id)}`) }
  }

  return (
    <VStack gap={2}>
      <Button label={primary ? 'Share link' : 'Send link again'} variant={primary ? 'primary' : 'secondary'} onClick={share} />
      {withPhones.map(p => (
        <Button key={p.id} label={`Send to ${p.name} on WhatsApp`} onClick={() => { window.open(whatsappTo(fullNumber(p), message), '_blank', 'noopener'); setStatus(`Opened WhatsApp for ${p.name}.`) }} />
      ))}
      <Button label="Copy link" variant="ghost" onClick={copy} />
      {status && <Text as="p" role="status">{status}</Text>}
    </VStack>
  )
}

/** In a Space's Decisions: the family vote in one line, and one button for what to do next. */
/**
 * The family vote's button, Ask family, then See votes, then See results, beside an optional second button
 * (the Space's Sell & let go list) as two equal halves of one row. How the vote stands wraps below at full
 * width, so a long list of names can't squeeze the buttons.
 */
export function VoteCard({ space, results, onAsk, onOpen, side }) {
  const link = space.voteLink
  const { voted, waiting } = link ? turnout(space, results) : { voted: [], waiting: [] }
  const line = !link ? null : link.final
    ? `Family vote ended ${voteDay(link.final.endedAt)} · ${voted.length} of ${link.voters.length} voted`
    : `Family vote: ${voted.length ? `${andList(voted)} voted` : 'no votes yet'}${waiting.length ? ` · waiting for ${andList(waiting)}` : ''}`
  const vote = link
    ? <Button label={link.final ? 'See results' : 'See votes'} className="grow" onClick={onOpen} />
    : <Button label="Ask family" className="grow" onClick={onAsk} />
  return (
    <VStack gap={1}>
      <HStack gap={2}>{vote}{side}</HStack>
      {line && <Text as="p" type="supporting" color="secondary">{line}</Text>}
    </VStack>
  )
}

const andList = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0])

/**
 * Making a family vote link for one Space: choose the items (all, or the ones passed in) and who can
 * vote (everyone on the list), see what gets shared, then send the link.
 */
export default function VoteSetup({ space, people, preselect, onCreated, onBack, onPeople }) {
  const items = sortItems(space).inSpace
  const [itemIds, setItemIds] = useState(() => (preselect ?? items.map(i => i.id)).map(String))
  const [voterIds, setVoterIds] = useState(() => people.map(p => p.id))
  const [creating, setCreating] = useState(false)
  const [problem, setProblem] = useState(null)
  const [made, setMade] = useState(false)
  const tooMany = itemIds.length > MAX_VOTE_ITEMS
  const ready = itemIds.length > 0 && voterIds.length > 0 && !tooMany

  async function create() {
    setCreating(true)
    setProblem(null)
    try {
      const chosen = items.filter(i => itemIds.includes(String(i.id)))
      const voters = people.filter(p => voterIds.includes(p.id))
      const { id, ownerToken, expiresAt } = await createVoteLink(await linkPayload(space, chosen, voters))
      onCreated({ id, ownerToken, expiresAt, createdAt: new Date().toISOString(), itemIds: chosen.map(i => i.id), voters: voters.map(p => ({ id: p.id, name: p.name })) })
      setMade(true)
    } catch (err) {
      setProblem(err.message)
    } finally {
      setCreating(false)
    }
  }

  const top = <HStack><IconButton label={space.spaceName} icon={<Icon icon="chevronLeft" />} onClick={onBack} /></HStack>

  if (made && space.voteLink) {
    return (
      <VStack gap={5} padding={4} className="inventory">
        {top}
        <VStack gap={1}>
          <Heading level={1}>Your vote link is ready</Heading>
          <Text as="p" color="secondary">Send it to {space.voteLink.voters.map(v => v.name).join(', ')}. They pick their name and vote; their votes show on each item. It's open until {voteDay(space.voteLink.expiresAt)}.</Text>
        </VStack>
        <ShareVoteLink space={space} people={people} />
        <Button label="Done" onClick={onBack} />
      </VStack>
    )
  }

  if (!people.length) {
    return (
      <VStack gap={5} padding={4} className="inventory">
        {top}
        <VStack gap={1}>
          <Heading level={1}>Ask family to vote</Heading>
          <Text as="p" color="secondary">Only people on your list can vote. Add the people you live with first.</Text>
        </VStack>
        <Button label="Add people" variant="primary" onClick={onPeople} />
      </VStack>
    )
  }

  return (
    <VStack gap={5} padding={4} className="inventory">
      {top}
      <VStack gap={1}>
        <Heading level={1}>Ask family to vote</Heading>
        <Text as="p" color="secondary">They'll vote Keep, Sell or Let go on each item, and can skip any. Votes are advice; you still decide.</Text>
      </VStack>
      {space.voteLink && <Banner status="warning" title={`This replaces the link you sent on ${voteDay(space.voteLink.createdAt)}.`} description="Its votes are deleted." />}

      <VStack gap={2}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <Heading level={2}>Items ({itemIds.length})</Heading>
          <Button label={itemIds.length === items.length ? 'Clear all' : 'Choose all'} variant="ghost" onClick={() => setItemIds(itemIds.length === items.length ? [] : items.map(i => String(i.id)))} />
        </HStack>
        <CheckboxList label="Items to vote on" value={itemIds} onChange={setItemIds}>
          {items.map(i => <CheckboxListItem key={i.id} value={String(i.id)} label={i.name} description={i.details?.askingPrice ? `Asking $${i.details.askingPrice}` : undefined} />)}
        </CheckboxList>
        {tooMany && <Text as="p" role="alert">Choose up to {MAX_VOTE_ITEMS} items for one link.</Text>}
      </VStack>

      <CheckboxList label="Who can vote" value={voterIds} onChange={setVoterIds}>
        {people.map(p => <CheckboxListItem key={p.id} value={p.id} label={p.name} description={p.relationship || undefined} />)}
      </CheckboxList>

      <VStack gap={1}>
        <Heading level={3}>What's shared</Heading>
        <Text as="p" color="secondary">
          The chosen items' names, small pictures and asking prices, and the voters' names, are saved on the Spaces server. Anyone with the link can see them. Phone numbers and relationships stay on this phone. The link and its votes are deleted after 14 days, or when you stop it.
        </Text>
      </VStack>
      {/* Above the button, where it's seen: below it, the message fell off the bottom of the screen. */}
      {problem && <Banner status="error" title="The link wasn't made." description={problem} />}
      <Button label="Create vote link" variant="primary" isDisabled={!ready} isLoading={creating} onClick={create} />
    </VStack>
  )
}
