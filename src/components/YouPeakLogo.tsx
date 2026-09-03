interface YouPeakLogoProps {
  className?: string;
  /** Text size in px */
  size?: number;
}

/** YouPeak wordmark — serif type only, no icon. */
export function YouPeakLogo({ className = '', size = 36 }: YouPeakLogoProps) {
  const textSize = size * 0.85;

  return (
    <span
      className={`inline-flex font-serif font-semibold tracking-tight text-[var(--color-logo)] ${className}`}
      style={{ fontSize: textSize }}
    >
      YouPeak
    </span>
  );
}
