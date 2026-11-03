import './Inventory.css'

/** Rings pulsing toward a small gold light while Muse works, like the welcome tunnel. Small for inline waits. */
export default function ScanPulse({ label = 'Finding things', small = false }) {
  return (
    <svg className={small ? 'scan-pulse scan-pulse-small' : 'scan-pulse'} viewBox="0 0 120 120" role="img" aria-label={label}>
      <circle className="scan-pulse-ring" cx="60" cy="60" r="54" />
      <circle className="scan-pulse-ring" cx="60" cy="60" r="40" />
      <circle className="scan-pulse-ring" cx="60" cy="60" r="26" />
      <circle className="scan-pulse-light" cx="60" cy="60" r="10" />
    </svg>
  )
}
