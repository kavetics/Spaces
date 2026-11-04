import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import tunnelArt from './assets/welcome-gold.webp'
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

  // The gold line tunnel (made with Meta's Muse Image) shows from the start: it's the loading screen while the
  // scanner loads, and the words come up on its dark floor once it's ready.
  return (
    <VStack className="welcome" hAlign="center" vAlign="end" gap={6} padding={6}>
      <img className="welcome-art" src={tunnelArt} alt="" />

      {status === 'loading' && <Text as="p" color="secondary" justify="center" role="status" className="welcome-loading">Getting the scanner ready…</Text>}

      {status === 'failed' && (
        <VStack gap={4} hAlign="center" role="alert">
          <Text as="p" justify="center">We couldn't load the scanner. Check your connection and try again.</Text>
          <Button label="Try again" variant="primary" onClick={() => window.location.reload()} />
        </VStack>
      )}

      {status === 'ready' && (
        <VStack gap={6} hAlign="center">
          <VStack gap={3} hAlign="center" className="welcome-title" onAnimationEnd={() => setShowButton(true)}>
            <Heading level={1} type="display-1" justify="center" className="welcome-name">SPACES</Heading>
            {/* What it is, then how, in three short steps. */}
            <VStack gap={1} hAlign="center">
              <Text as="p" type="large" justify="center">Your home, understood by Muse.</Text>
              <Text as="p" color="secondary" justify="center">Scan a room. Decide together. Keep up with the chores.</Text>
            </VStack>
          </VStack>
          {showButton && (
            <Center className="welcome-button">
              <Button label="Scan your first Space" variant="primary" onClick={() => setAskConsent(true)} />
            </Center>
          )}
        </VStack>
      )}
      <Text as="p" type="supporting" color="secondary" justify="center" className="welcome-credit">Art made with Muse Image</Text>

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
    </VStack>
  )
}
