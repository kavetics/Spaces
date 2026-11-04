import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack } from '@astryxdesign/core/HStack'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { suggestTasks } from './api.js'
import ScanPulse from './ScanPulse.jsx'
import { countLabel } from './spaceItems.js'
import { checkSuggestions, taskLine } from './tasks.js'

const thingNames = things => (things.length > 3 ? `${things.slice(0, 3).map(t => t.name).join(', ')} and ${things.length - 3} more` : things.map(t => t.name).join(', '))

/**
 * Muse suggests 3 to 5 tasks from a Space's Things, with who might do each, from the people who use it
 * (or the whole household when nobody is set). Plain code checks each one before it shows; nothing is
 * added until the person taps Add. onAdd(task fields).
 */
export default function TaskSuggest({ space, things, people, existing, onAdd, onClose }) {
  const [suggestions, setSuggestions] = useState(null)
  const [problem, setProblem] = useState(null)
  const [answered, setAnswered] = useState({}) // index → 'added' | 'skipped'
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setProblem(null)
    setSuggestions(null)
    // Short references stand in for ids, and are turned back into ids before anything is checked.
    suggestTasks({
      space: space.spaceName,
      things: things.map((t, n) => ({ ref: `t${n}`, name: t.name, description: t.description, category: t.category })),
      people: people.map((p, n) => ({ ref: `p${n}`, name: p.name })),
      existing: existing.map(t => t.name),
    }).then(({ tasks }) => {
      if (cancelled) return
      const thingAt = ref => things[Number(String(ref).slice(1))]?.id
      const personAt = ref => people[Number(String(ref ?? '').slice(1))]?.id
      setSuggestions(checkSuggestions(
        (tasks ?? []).map(t => ({ ...t, thingIds: (t.things ?? []).map(thingAt), personId: t.person ? personAt(t.person) : null })),
        { things, people, existing },
      ))
    }, err => { if (!cancelled) setProblem(err.message) })
    return () => { cancelled = true }
    // Asks once per opening, and again on Try again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const close = () => onClose()
  return (
    <Dialog isOpen onOpenChange={open => { if (!open) close() }} width={440}>
      <Layout
        header={<DialogHeader title="Tasks Muse suggests" onOpenChange={open => { if (!open) close() }} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Text as="p" color="secondary">
                From the {countLabel(things.length, 'thing')} in {space.spaceName}{people.length ? ', with who might do each' : ''}. Muse gets only their names{people.length ? ' and who uses it' : ''}. Nothing is saved off this phone.
              </Text>
              {!suggestions && !problem && (
                <HStack gap={2} vAlign="center" role="status">
                  <ScanPulse label="Thinking" small />
                  <Text color="secondary">Muse is thinking…</Text>
                </HStack>
              )}
              {problem && (
                <VStack gap={2} role="alert">
                  <Text as="p">Couldn't get suggestions. {problem}</Text>
                  <HStack><Button label="Try again" onClick={() => setAttempt(n => n + 1)} /></HStack>
                </VStack>
              )}
              {suggestions?.length === 0 && <Text as="p">Muse has nothing new to suggest for this Space.</Text>}
              {suggestions?.length > 0 && (
                <List hasDividers edge="flush">
                  {suggestions.map((s, n) => {
                    const forThings = things.filter(t => s.thingIds.includes(t.id))
                    return (
                      <ListItem
                        key={n}
                        align="start"
                        label={<Text as="p">{s.name}</Text>}
                        description={(
                          <VStack gap={1}>
                            <Text as="p" type="supporting">{taskLine(s, people)}</Text>
                            {forThings.length > 0 && <Text as="p" type="supporting" color="secondary">{thingNames(forThings)}</Text>}
                            <Text as="p" type="supporting" className="shared-label">Suggested by Muse{s.reason ? ` · ${s.reason}` : ''}</Text>
                            {answered[n]
                              ? <Text as="p" type="supporting" color="secondary">{answered[n] === 'added' ? 'Added. Change it from the list.' : 'Skipped.'}</Text>
                              : (
                                <HStack gap={1}>
                                  <Button label="Add" aria-label={`Add: ${s.name}`} onClick={() => { onAdd(s); setAnswered(a => ({ ...a, [n]: 'added' })) }} />
                                  <Button label="Skip" aria-label={`Skip: ${s.name}`} variant="ghost" className="quiet-action" onClick={() => setAnswered(a => ({ ...a, [n]: 'skipped' }))} />
                                </HStack>
                              )}
                          </VStack>
                        )}
                        startContent={forThings[0]?.picture ? <img className="inventory-crop" src={forThings[0].picture} alt="" /> : <span className="inventory-crop" />}
                      />
                    )
                  })}
                </List>
              )}
              <Button label="Done" variant={suggestions?.length && suggestions.every((_, n) => answered[n]) ? 'primary' : 'secondary'} onClick={close} />
            </VStack>
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
