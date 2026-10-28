import { useEffect, useState } from 'react'
import { openRootsware, rootswareAvailable } from '../lib/desktopShell'

/**
 * "← Rootsware": back to the family launcher, as ZaVolan, ZaFon and ZaOFK link back to ZaPass. Desktop only
 * (Rootsware has no public web build) and only when a Rootsware build is found, so it never leads nowhere.
 */
export function BackToRootsware({ variant = 'gate', className }: { variant?: 'gate' | 'sidebar'; className?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let live = true
    void rootswareAvailable().then((ok) => live && setShow(ok))
    return () => {
      live = false
    }
  }, [])
  if (!show) return null
  return (
    <button type="button" onClick={() => void openRootsware().catch(() => setShow(false))} className={`rw-back rw-back--${variant}${className ? ` ${className}` : ''}`} aria-label="Back to Rootsware" title="Open Rootsware, the family launcher">
      <svg className="rw-back__chevron" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M10.2 3.2 5.4 8l4.8 4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg className="rw-back__mark" viewBox="240 222 544 580" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="44" strokeLinecap="round">
          <path d="M512 482V430C512 380 330 400 330 322M512 430C512 360 448 352 448 272M512 430C512 360 576 352 576 272M512 430C512 380 694 400 694 322" />
          <path d="M512 542V594C512 644 330 624 330 702M512 594C512 664 448 672 448 752M512 594C512 664 576 672 576 752M512 594C512 644 694 624 694 702" />
        </g>
        <rect x="268" y="497" width="488" height="30" rx="15" fill="currentColor" />
      </svg>
      <span>Rootsware</span>
    </button>
  )
}
