import { useEffect, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { getMyVotes, getVoteLink, sendMyVotes } from './api.js'
import { VOTE_CHOICES, voteDay } from './votes.js'
import './Inventory.css'

// Which name this phone picked for a link, so coming back goes straight to their votes.
const remembered = id => { try { return localStorage.getItem(`vote:${id}`) } catch { return null } }
const remember = (id, voter) => { try { localStorage.setItem(`vote:${id}`, voter) } catch { /* private browsing */ } }

/**
 * The page family members open from a vote link. No app or account: they pick their name, vote on
 * each item, and send. They see only the items, never anyone's votes or what the owner decided.
 */
export default function VotePage({ id }) {
  const [link, setLink] = useState(null)
  const [problem, setProblem] = useState(null)
  const [voter, setVoter] = useState(null)
  const [answers, setAnswers] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function pick(voterId) {
    setProblem(null)
    try {
      const mine = await getMyVotes(id, voterId)
      setAnswers(mine.answers)
      setSent(Boolean(mine.updatedAt))
      setVoter(voterId)
      remember(id, voterId)
    } catch (err) { setProblem(err.message) }
  }

  useEffect(() => {
    getVoteLink(id).then(found => {
      setLink(found)
      const before = remembered(id)
      if (found.voters.some(v => v.id === before)) pick(before)
    }, err => setProblem(err.message))
    // Loads once per link.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function send() {
    setSending(true)
    setProblem(null)
    try {
      await sendMyVotes(id, voter, answers)
      setSent(true)
      window.scrollTo?.(0, 0)
      document.querySelector('.inventory')?.scrollTo?.(0, 0)
    } catch (err) { setProblem(err.message) } finally { setSending(false) }
  }

  if (!link) {
    return (
      <VStack gap={4} padding={4} className="inventory-center" hAlign="center" vAlign="center">
        {problem ? <Text as="p" justify="center">{problem}</Text> : <Spinner />}
      </VStack>
    )
  }

  const name = link.voters.find(v => v.id === voter)?.name
  const answered = link.items.filter(i => answers[i.ref]).length

  return (
    <VStack gap={5} padding={4} className="inventory">
      <VStack gap={1}>
        <Heading level={1}>Keep, sell or let go?</Heading>
        <Text as="p" color="secondary">Things from {link.spaceName}. Your votes help decide; nothing happens to anything until it's talked over.</Text>
      </VStack>

      {!voter && (
        <VStack gap={3}>
          <Heading level={2}>Who are you?</Heading>
          {link.voters.map(v => <Button key={v.id} label={v.name} size="lg" onClick={() => pick(v.id)} />)}
        </VStack>
      )}

      {voter && (
        <>
          {sent && <Banner status="success" title={`Thanks, ${name}. Your votes are in.`} description={`You can change them here until ${voteDay(link.expiresAt)}.`} />}
          <HStack gap={2} vAlign="center" hAlign="between">
            <Text type="label">Voting as {name}</Text>
            <Button label="Not you?" variant="ghost" size="sm" onClick={() => { setVoter(null); setAnswers({}); setSent(false) }} />
          </HStack>
          <VStack gap={5}>
            {link.items.map(item => (
              <VStack key={item.ref} gap={2}>
                {item.picture && <img className="item-photo" src={item.picture} alt={item.name} />}
                <VStack gap={1}>
                  <Heading level={2}>{item.name}</Heading>
                  {item.price && <Text color="secondary">Asking ${item.price}</Text>}
                </VStack>
                <SegmentedControl label={`Your vote on ${item.name}`} layout="fill" value={answers[item.ref] ?? ''} onChange={choice => { setAnswers(a => ({ ...a, [item.ref]: choice })); setSent(false) }}>
                  {VOTE_CHOICES.map(([value, label]) => <SegmentedControlItem key={value} value={value} label={label} />)}
                </SegmentedControl>
              </VStack>
            ))}
          </VStack>
          <VStack gap={2}>
            <Button label={sent ? 'Votes sent' : 'Send my votes'} variant="primary" size="lg" isDisabled={!answered || sent} isLoading={sending} onClick={send} />
            <Text as="p" type="supporting" color="secondary" justify="center">{answered} of {link.items.length} answered. Skip any you're not sure about.</Text>
          </VStack>
        </>
      )}

      {problem && <Text as="p" role="alert">{problem}</Text>}
      <Text as="p" type="supporting" color="secondary" justify="center">
        Only the people listed can vote. This page and its votes are deleted on {voteDay(link.expiresAt)}.
      </Text>
    </VStack>
  )
}
