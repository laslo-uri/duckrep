export function YouPeakMark({
  size,
  className = '',
  animateIn = false,
}: {
  size: number;
  className?: string;
  /** One-time chart draw, used on the lobby lockup. */
  animateIn?: boolean;
}) {
  return (
    <span className="yp-logo-mark">
      <svg width={size} height={size} viewBox="0 0 1024 1024" className={`shrink-0 ${className}`} aria-hidden>
        <defs>
          <linearGradient id="ypMarkBg" x1="512" y1="0" x2="512" y2="1024" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1b1f26" />
            <stop offset="1" stopColor="#121418" />
          </linearGradient>
          <linearGradient id="ypMarkPeakL" x1="184" y1="430" x2="287" y2="799" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#7ff2f8" />
            <stop offset="1" stopColor="#1596c9" />
          </linearGradient>
          <linearGradient id="ypMarkPeakR" x1="717" y1="389" x2="819" y2="799" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4defc9" />
            <stop offset="1" stopColor="#0e9f86" />
          </linearGradient>
          <linearGradient id="ypMarkMainL" x1="410" y1="246" x2="348" y2="799" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#bdf6fa" />
            <stop offset="1" stopColor="#2cc4e8" />
          </linearGradient>
          <linearGradient id="ypMarkMainR" x1="614" y1="246" x2="717" y2="799" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2cc4e8" />
            <stop offset="1" stopColor="#0b5e74" />
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" rx="225" fill="url(#ypMarkBg)" />
        <g className="yp-logo-peaks">
          <path fill="url(#ypMarkPeakL)" d="M287 430 L82 799 L287 799 Z" />
          <path fill="#0b5e74" d="M287 430 L471 799 L287 799 Z" />
          <path fill="#eafcfe" opacity="0.85" d="M287 430 L246 522 L297 502 Z" />
          <path fill="url(#ypMarkPeakR)" d="M717 389 L553 799 L717 799 Z" />
          <path fill="#086655" d="M717 389 L942 799 L717 799 Z" />
          <path fill="#d8fff2" opacity="0.85" d="M717 389 L676 492 L727 471 Z" />
          <path fill="url(#ypMarkMainL)" d="M512 205 L266 799 L512 799 Z" />
          <path fill="url(#ypMarkMainR)" d="M512 205 L778 799 L512 799 Z" />
          <path fill="#9ef4f9" opacity="0.7" d="M512 205 L420 451 L512 553 Z" />
          <path fill="#0b5e74" opacity="0.6" d="M512 205 L604 430 L512 553 Z" />
          <path fill="#f3f6f8" d="M512 205 L451 338 L512 307 L573 328 Z" />
        </g>
        <path
          className={animateIn ? 'yp-logo-line yp-mark-line' : 'yp-logo-line'}
          pathLength="30"
          fill="none"
          stroke="#f3f6f8"
          strokeWidth="31"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M307 635 L451 492 L573 553 L737 307"
        />
        <g className="yp-logo-dot">
          <circle cx="737" cy="307" r="82" fill="#00f0a0" opacity="0.25" />
          <circle cx="737" cy="307" r="46" fill="#00f0a0" />
        </g>
      </svg>
    </span>
  );
}

interface YouPeakLogoProps {
  className?: string;
  size?: number;
}

export function YouPeakLogo({ className = '', size = 36 }: YouPeakLogoProps) {
  const textSize = size * 0.72;
  const mark = Math.max(22, Math.round(size * 0.78));

  return (
    <span
      className={`yp-logo inline-flex items-center gap-2 font-serif font-semibold tracking-tight text-[var(--color-logo)] ${className}`}
      style={{ fontSize: textSize }}
    >
      <YouPeakMark size={mark} />
      <span className="yp-wordmark max-[340px]:sr-only">YouPeak</span>
    </span>
  );
}
