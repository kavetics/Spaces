import { useEffect, useRef, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Text } from '@astryxdesign/core/Text'
import { Theme } from '@astryxdesign/core/theme'
import { VStack } from '@astryxdesign/core/VStack'
import { themes, defaultThemeSlug } from './astryx-themes'
import { SCAN, cameraDirection, turnTo } from './sweep.js'
import { grabFrame, useCamera } from './useCamera.js'
import './Camera.css'

/**
 * Full-screen guided room scan. The user stands in the middle of the room and taps Start; the app
 * guides them to 8 directions (every 45°, turning right) and takes a photo by itself whenever the
 * phone is lined up and still. Always the 1× lens, no zoom. Dark theme, since it sits on live video.
 * onCapture({ frames: Blob[], compass })
 */
export default function Camera({ title, hint, onCapture, onBack, onUpload, onTips }) {
  const { video, status, error, stop: stopCamera, retry } = useCamera()
  const direction = useRef(null) // { heading, pitch } from the motion sensor
  const scan = useRef(null)
  const [phase, setPhase] = useState('ready') // ready → scanning → saving
  const state = status === 'ready' ? phase : status // starting | error | ready | scanning | saving
  const [live, setLive] = useState(null) // the guide right now, for the UI
  const [flash, setFlash] = useState(false)

  function stop() {
    clearInterval(scan.current?.timer)
    stopCamera()
  }

  useEffect(() => {
    const onOrientation = e => { direction.current = cameraDirection(e) }
    window.addEventListener('deviceorientation', onOrientation)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      clearInterval(scan.current?.timer)
    }
  }, [])

  function takeShot(s) {
    s.frames.push(grabFrame(video.current))
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
    navigator.vibrate?.(30)
    s.step += 1
    s.stepStartedAt = performance.now()
    s.steadySince = null
    if (s.step >= SCAN.sides) finish()
  }

  function startScan() {
    if (state !== 'ready' || !video.current?.videoWidth) return
    const d = direction.current
    const s = {
      compass: d?.heading != null,
      base: d?.heading ?? 0, // the first photo is wherever they're facing now
      step: 0,
      frames: [],
      stepStartedAt: performance.now(),
      steadySince: null,
      history: [], // recent { heading, pitch, t } for the "hold still" check
    }
    scan.current = s
    s.timer = setInterval(() => (s.compass ? guideByCompass(s) : guideByTimer(s)), 100)
    setPhase('scanning')
  }

  // With a compass: show where to turn, and take the photo once lined up and still.
  function guideByCompass(s) {
    if (s.finishing) return
    const now = performance.now()
    const d = direction.current
    if (!d) return
    // Still = the phone stayed within a few degrees over the last moment. Sensor readings jitter,
    // so this looks at the spread over a short window, not reading-to-reading changes.
    s.history = [...s.history.filter(h => now - h.t < SCAN.steadyWindowMs), { ...d, t: now }]
    const spread = values => (values.length ? Math.max(...values) - Math.min(...values) : 0)
    const headings = s.history.map(h => h.heading).filter(h => h != null)
    const still = spread(s.history.map(h => h.pitch)) < SCAN.steadySpreadDeg && spread(headings.map(h => turnTo(headings[0], h))) < SCAN.steadySpreadDeg

    const target = (s.base + s.step * SCAN.stepDeg) % 360
    const diff = d.heading == null ? null : turnTo(d.heading, target)
    const level = Math.abs(d.pitch) < SCAN.levelDeg
    const aligned = diff != null && level && Math.abs(diff) <= SCAN.alignDeg
    const offset = diff == null ? 0 : Math.max(-140, Math.min(140, diff * 3))
    const guide = !level ? 'Hold the phone upright, facing the wall'
      : aligned ? 'Hold still'
      : diff > 0 ? 'Turn slowly to the right'
      : 'Back to the left a little'
    if (aligned && still) s.steadySince ??= now
    else s.steadySince = null
    const hold = s.steadySince ? Math.min(1, (now - s.steadySince) / SCAN.steadyMs) : 0
    setLive({ taken: s.step, guide, aligned, hold, offset, compass: true })
    if (hold >= 1) takeShot(s)
  }

  // Without a compass: timed prompts. Turn, hold still, photo.
  function guideByTimer(s) {
    if (s.finishing) return
    const elapsed = performance.now() - s.stepStartedAt
    const turnMs = s.step === 0 ? 0 : SCAN.timedTurnMs
    const turning = elapsed < turnMs
    const hold = turning ? 0 : Math.min(1, (elapsed - turnMs) / SCAN.timedHoldMs)
    setLive({ taken: s.step, guide: turning ? 'Turn a little to the right' : 'Hold still', aligned: !turning, hold, offset: 0, compass: false })
    if (hold >= 1) takeShot(s)
  }

  async function finish() {
    const s = scan.current
    if (!s || s.finishing) return
    s.finishing = true
    clearInterval(s.timer)
    setPhase('saving')
    const frames = (await Promise.all(s.frames)).filter(Boolean)
    stop()
    onCapture({ frames, compass: s.compass })
  }

  function cancel() {
    clearInterval(scan.current?.timer)
    scan.current = null
    setLive(null)
    setPhase('ready')
  }

  const scanning = state === 'scanning'
  const message = { starting: 'Starting camera…', saving: 'Scan complete', error }[state]

  return (
    <Theme theme={themes[defaultThemeSlug]} mode="dark">
      <section className="space-scan" aria-label={title}>
        <video ref={video} className="space-scan-video" playsInline muted />
        {scanning && live && <Reticle live={live} />}
        {flash && <span className="space-scan-flash" />}
        {message && (
          <Center className="space-scan-message" padding={6}>
            <Text as="p" type="large" justify="center" role={state === 'error' ? 'alert' : 'status'}>{message}</Text>
          </Center>
        )}

        <VStack gap={3} padding={4} className="space-scan-top">
          <HStack gap={3} vAlign="center">
            <IconButton
              label={scanning ? 'Cancel scan' : 'Back'}
              icon={<Icon icon={scanning ? 'close' : 'chevronLeft'} />}
              onClick={scanning ? cancel : () => { stop(); onBack() }}
            />
            <Text type="label" weight="semibold" className="space-scan-pill">{scanning && live ? `${live.taken} of ${SCAN.sides} photos` : title}</Text>
          </HStack>
        </VStack>

        <VStack gap={3} padding={6} hAlign="center" className="space-scan-bottom">
          {state !== 'starting' && state !== 'saving' && state !== 'error' && (
            <Text as="p" type="large" weight="semibold" justify="center" className="space-scan-pill" aria-live="polite">{scanning ? live?.guide : hint}</Text>
          )}
          {state === 'error' && <Button label="Turn on camera" variant="primary" onClick={retry} />}
          {state === 'ready' && <Button label="Start scan" variant="primary" onClick={startScan} />}
          {scanning && live?.taken >= SCAN.minSidesForDone && <Button label="Done turning" onClick={finish} />}
          {onUpload && (state === 'ready' || state === 'error') && <Button label="Upload a photo instead" variant="ghost" onClick={onUpload} />}
          {onTips && (state === 'ready' || state === 'error') && <Button label="Scanning tips" variant="ghost" onClick={onTips} />}
        </VStack>
      </section>
    </Theme>
  )
}

// Line the dot up with the ring and hold still. The ring fills as you hold.
function Reticle({ live }) {
  const { offset, aligned, hold, compass } = live
  return (
    <svg className="space-scan-reticle" viewBox="-160 -160 320 320" aria-hidden="true">
      <circle r="42" className="space-scan-edge" />
      <circle r="42" className={`space-scan-ring ${aligned ? 'is-aligned' : ''}`} />
      <circle r="42" className="space-scan-hold" pathLength="1" strokeDasharray={`${hold} 1`} />
      {compass && <circle r="12" className="space-scan-dot" style={{ transform: `translateX(${offset}px)` }} />}
    </svg>
  )
}
