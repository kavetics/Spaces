import { Avatar } from '@astryxdesign/core/Avatar'
import { AvatarGroup } from '@astryxdesign/core/AvatarGroup'

/** People as overlapping circles with the first letter of their name (first word only, so "Aunt Priya" is A). */
export default function Initials({ people, size = 'xsm' }) {
  if (!people.length) return null
  return (
    <AvatarGroup size={size}>
      {people.map(p => <Avatar key={p.id} name={p.name.trim().split(/\s+/)[0]} size={size} />)}
    </AvatarGroup>
  )
}

export const peopleLabel = n => (n === 1 ? '1 person' : `${n} people`)
