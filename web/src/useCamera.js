import { useEffect, useRef, useState } from 'react'

// Our camera rules. Always the 1× lens at 1× zoom: the ultra-wide's distortion throws off what the AI sees.
const CAMERA = {
  // Ask for 4:3, the shape iPhone photos use; the phone picks the closest it supports.
  width: 1920,
  height: 1440,
}

// iPhones list several back cameras; "Back Camera" is the plain 1× lens.
const isMainBackLens = label => /^back camera$/i.test(label) ||
  (/back|rear/i.test(label) && !/ultra|wide|tele|dual|triple|front/i.test(label))

// Dev mode mounts components twice. Only one camera start runs at a time, or they can knock each other out.
let previousStart = Promise.resolve()

/** Starts the back camera on a <video> element. */
export function useCamera() {
  const video = useRef(null)
  const stream = useRef(null)
  const [status, setStatus] = useState('starting') // starting → ready | error
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('starting')
    previousStart = previousStart.catch(() => {}).then(() => (cancelled ? undefined : start()))
    previousStart.catch(err => {
      if (cancelled) return
      setError(cameraError(err))
      setStatus('error')
    })
    return () => {
      cancelled = true
      stream.current?.getTracks().forEach(t => t.stop())
      stream.current = null
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('insecure')
      let s = await open({ facingMode: { ideal: 'environment' } })
      // Device names are only visible after permission is granted, so switch lenses second.
      const devices = await navigator.mediaDevices.enumerateDevices()
      const main = devices.find(d => d.kind === 'videoinput' && isMainBackLens(d.label))
      if (main && s.getVideoTracks()[0].getSettings().deviceId !== main.deviceId) {
        s.getTracks().forEach(t => t.stop())
        s = await open({ deviceId: { exact: main.deviceId } })
      }
      if (cancelled) return s.getTracks().forEach(t => t.stop())
      stream.current = s
      const track = s.getVideoTracks()[0]
      const caps = track.getCapabilities?.() ?? {}
      if (caps.zoom) await track.applyConstraints({ advanced: [{ zoom: Math.max(caps.zoom.min, 1) }] }).catch(() => {})
      // iPhone only plays live video by itself when it's muted and inline, set before play().
      const v = video.current
      v.muted = true
      v.setAttribute('muted', '')
      v.setAttribute('playsinline', '')
      v.srcObject = s
      // Don't let a stuck play() hide the screen's buttons; START tries playing again from the tap.
      await Promise.race([v.play(), new Promise(resolve => setTimeout(resolve, 3000))])
      setStatus('ready')
    }

    function open(device) {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...device, width: { ideal: CAMERA.width }, height: { ideal: CAMERA.height } },
      })
    }
  }, [attempt])

  // Asking again from a tap: the browser can refuse a request made when the page loads, then allow this one.
  const retry = () => {
    setError(null)
    setStatus('starting')
    setAttempt(n => n + 1)
  }

  const stop = () => {
    stream.current?.getTracks().forEach(t => t.stop())
    stream.current = null
  }
  return { video, stream, status, error, stop, retry }
}

/** One still from the live feed (the whole camera frame), shrunk for upload. */
export function grabFrame(video, maxSide = 1280, quality = 0.85) {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}

function cameraError(err) {
  if (err.message === 'insecure') return 'The camera needs the secure link (https://). Check the address and try again.'
  if (err.name === 'NotAllowedError') return 'The camera was blocked. Tap below and choose Allow. If it stays blocked, allow access in iPhone Settings → Apps → your browser.'
  if (err.name === 'NotFoundError') return 'No camera found on this device.'
  return `Could not start the camera (${err.name || err.message}).`
}
