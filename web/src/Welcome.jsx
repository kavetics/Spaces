import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import './Welcome.css'

const MIN_LOADING_MS = 1800 // long enough to read as a scan, not a flicker
const MAX_LOADING_MS = 15000 // a hung network shouldn't leave the animation running forever

let loadedOnce = false // coming back from the scanner shouldn't replay the loading

/** The opening screen: loads the scanner, reveals the title, then asks for consent before scanning. */
export default function Welcome({ loadScanner, onAccept }) {
  const [status, setStatus] = useState(loadedOnce ? 'ready' : 'loading') // loading → ready | failed
  const [showButton, setShowButton] = useState(loadedOnce)
  const [askConsent, setAskConsent] = useState(false)

  useEffect(() => {
    if (loadedOnce) return
    let cancelled = false
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    const timedOut = wait(MAX_LOADING_MS).then(() => { throw new Error('Scanner took too long to load') })
    Promise.all([Promise.race([loadScanner(), timedOut]), wait(MIN_LOADING_MS)]).then(() => {
      if (cancelled) return
      loadedOnce = true
      setStatus('ready')
    }).catch(() => {
      if (!cancelled) setStatus('failed')
    })
    return () => { cancelled = true }
  }, [loadScanner])

  return (
    <Center className="welcome" padding={6}>
      {status === 'loading' && <ScanAnimation />}

      {status === 'failed' && (
        <VStack gap={4} hAlign="center" role="alert">
          <Text as="p" justify="center">We couldn't load the scanner. Check your connection and try again.</Text>
          <Button label="Try again" variant="primary" onClick={() => window.location.reload()} />
        </VStack>
      )}

      {status === 'ready' && (
        <VStack gap={8} hAlign="center">
          <VStack gap={2} hAlign="center" className="welcome-title" onAnimationEnd={() => setShowButton(true)}>
            <Heading level={1} type="display-1" justify="center">SPACES</Heading>
            <Text as="p" type="large" color="secondary" justify="center">Scan a room. Spaces learns what's in your home, who shares it and what you've decided, and Muse can use it.</Text>
            {/* The four parts of the model, so it's clear from the first screen what Spaces builds. */}
            <Grid columns={2} gap={2} className="welcome-parts">
              {['Things', 'People', 'Decisions', 'Muse'].map(part => <Text key={part} as="p" weight="medium" justify="center" className="welcome-part">{part}</Text>)}
            </Grid>
          </VStack>
          {showButton && (
            <Center className="welcome-button">
              <Button label="Scan your first Space" variant="primary" size="lg" onClick={() => setAskConsent(true)} />
            </Center>
          )}
        </VStack>
      )}

      <Dialog isOpen={askConsent} onOpenChange={setAskConsent} purpose="required" width={420}>
        <Layout
          header={<DialogHeader title="Before you scan" />}
          content={
            <LayoutContent>
              <VStack gap={3}>
                <Text as="p">Spaces shares your room photos with Meta's AI models to identify what's in them.</Text>
                <Text as="p">Anything in view may be included, so put away private items, and keep other people, especially children, out of frame.</Text>
                {import.meta.env.DEV && <Text as="p">This is a test version: we also save your photos to help improve Spaces.</Text>}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <VStack gap={2}>
                <Button label="I agree" variant="primary" onClick={() => { setAskConsent(false); onAccept() }} />
                <Button label="I don't agree" variant="ghost" onClick={() => setAskConsent(false)} />
              </VStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </Center>
  )
}

/** A scanner sweeping around a room, like the real scan does. */
function ScanAnimation() {
  return (
    <svg className="welcome-scan" viewBox="0 0 100 100" role="img" aria-label="Loading the scanner">
      <circle cx="50" cy="50" r="44" className="welcome-scan-ring" />
      <circle cx="50" cy="50" r="28" className="welcome-scan-ring" />
      <circle cx="50" cy="50" r="12" className="welcome-scan-ring" />
      <g className="welcome-scan-sweep">
        <line x1="50" y1="50" x2="50" y2="6" />
        <circle cx="50" cy="6" r="3.5" />
      </g>
    </svg>
  )
}
