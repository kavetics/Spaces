// Family votes: what goes into a vote link, and counting what came back. Counting is plain code.
import { votePicture } from './crop.js'

export const VOTE_CHOICES = [['keep', 'Keep'], ['sell', 'Sell'], ['donate', 'Let go']]
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

/** The family's votes on one item, most votes first. Items someone skipped don't count. */
export function tally(space, results, itemId) {
  const link = space.voteLink
  if (!link || !results || !link.itemIds.includes(itemId)) return null
  const names = Object.fromEntries(link.voters.map(v => [v.id, v.name]))
  const byChoice = {}
  for (const { voterId, answers } of results.votes) {
    const choice = answers[String(itemId)]
    // Skipped items have no vote. Old "Unsure" votes, from before it was removed, don't count either.
    if (!choiceLabel(choice) || !names[voterId]) continue
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

/** The family's pick for an item: the choice with the most votes, or null with no votes or a tie. */
export function topPick(counts) {
  if (!counts?.length) return null
  return counts.length === 1 || counts[0].voters.length > counts[1].voters.length ? counts[0].choice : null
}

/** The votes to show: kept on the phone once a vote has ended, otherwise as the server last sent them. */
export const resultsFor = (space, live) => space.voteLink?.final ?? live
