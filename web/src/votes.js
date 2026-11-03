// Family votes: what goes into a vote link, and counting what came back. Counting is plain code.
import { votePicture } from './crop.js'

export const VOTE_CHOICES = [['keep', 'Keep'], ['sell', 'Sell'], ['donate', 'Let go'], ['unsure', 'Unsure']]
export const MAX_VOTE_ITEMS = 25
const choiceLabel = choice => VOTE_CHOICES.find(([id]) => id === choice)?.[1]

export const voteDay = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const voteUrl = id => `${location.origin}/vote/${id}`
export const voteMessage = (space, id) => `Help us decide what to keep, sell or let go in our ${space.spaceName}. Tap your name and vote: ${voteUrl(id)}`

/**
 * What the server gets for a link: each item's name, a small picture and the asking price if there
 * is one. Voters are sent by their name on the list. Phones and relationships stay on this phone.
 */
export async function linkPayload(space, items, voters) {
  return {
    spaceName: space.spaceName,
    items: await Promise.all(items.map(async item => ({
      ref: String(item.id),
      name: item.name,
      picture: item.picture ? await votePicture(item.picture).catch(() => null) : null,
      price: item.details?.askingPrice ?? null,
    }))),
    voters: voters.map(p => ({ id: p.id, name: p.name })),
    ...(space.voteLink && { replaces: { id: space.voteLink.id, ownerToken: space.voteLink.ownerToken } }),
  }
}

/** The family's votes on one item, most votes first. "Unsure" doesn't count as a vote. */
export function tally(space, results, itemId) {
  const link = space.voteLink
  if (!link || !results || !link.itemIds.includes(itemId)) return null
  const names = Object.fromEntries(link.voters.map(v => [v.id, v.name]))
  const byChoice = {}
  for (const { voterId, answers } of results.votes) {
    const choice = answers[String(itemId)]
    if (!choice || choice === 'unsure' || !names[voterId]) continue
    ;(byChoice[choice] ??= []).push(names[voterId])
  }
  return Object.entries(byChoice)
    .map(([choice, voters]) => ({ choice, label: choiceLabel(choice), voters }))
    .sort((a, b) => b.voters.length - a.voters.length)
}

/** "Sell 2 (Mom, Dad) · Keep 1 (Brother)", or a note that no one has voted on it yet. */
export function tallyLine(counts) {
  if (!counts) return null
  if (!counts.length) return 'No votes on this yet.'
  return counts.map(c => `${c.label} ${c.voters.length} (${c.voters.join(', ')})`).join(' · ')
}

/** Who has sent votes and who hasn't. */
export function turnout(space, results) {
  const sent = new Set(results?.votes.map(v => v.voterId) ?? [])
  return {
    voted: space.voteLink.voters.filter(v => sent.has(v.id)).map(v => v.name),
    waiting: space.voteLink.voters.filter(v => !sent.has(v.id)).map(v => v.name),
  }
}
