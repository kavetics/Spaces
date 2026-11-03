import { useEffect, useState } from 'react'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import tunnelArt from './assets/welcome-gold.webp'
import './Welcome.css'

// The gold line tunnel fades in, the name fades in as it rises, then it all fades into the app:
// 2.4 seconds in all. The welcome screen opens the same way.
const SHOW_MS = 2000
const FADE_MS = 400

/** On every load with Spaces saved: the tunnel, the name and a line under it, then a fade into the app. Tap to skip. The art is made with Muse Image. */
export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), SHOW_MS)
    const done = setTimeout(onDone, SHOW_MS + FADE_MS)
    return () => { clearTimeout(leave); clearTimeout(done) }
    // Runs once, when the app opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <VStack className={`welcome splash${leaving ? ' splash-leaving' : ''}`} hAlign="center" vAlign="end" padding={6} onClick={onDone} aria-hidden="true">
      <img className="welcome-art" src={tunnelArt} alt="" />
      <VStack gap={3} hAlign="center" className="welcome-title splash-words">
        <Heading level={2} type="display-1" justify="center" className="welcome-name splash-name">SPACES</Heading>
        <Text as="p" color="secondary" justify="center">Spaces, Things, People, and Decisions, ready for Muse</Text>
      </VStack>
    </VStack>
  )
}

/** People who asked for less motion go straight in. */
export const wantsSplash = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
