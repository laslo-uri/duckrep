/**
 * The Duckrep mark: a dark duck with fire-orange wings biting a dumbbell, on a black tile.
 * Masters (from __draft/bird-apps-brand/duckrep): public/logo.svg (rounded tile),
 * public/logo-fullbleed.svg (square), public/duckrep-mark.svg (the duck alone).
 */
export function DuckrepMark({
  size,
  className = '',
  animateIn = false,
}: {
  size: number;
  className?: string;
  /** One rep on mount, used on the lobby and lock screen lockups. */
  animateIn?: boolean;
}) {
  return (
    <span className="dr-logo-mark">
      <img
        src="/logo.svg"
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={`dr-logo-img shrink-0 ${animateIn ? 'dr-mark-rep' : ''} ${className}`}
      />
    </span>
  );
}

/** "Duck" in the text colour, "rep" in the accent orange. */
export function DuckrepWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`dr-wordmark font-extrabold tracking-tight ${className}`}>
      Duck<span className="dr-wordmark-rep">rep</span>
    </span>
  );
}

interface DuckrepLogoProps {
  className?: string;
  size?: number;
}

export function DuckrepLogo({ className = '', size = 36 }: DuckrepLogoProps) {
  const textSize = size * 0.72;
  const mark = Math.max(22, Math.round(size * 0.78));

  return (
    <span
      className={`dr-logo inline-flex items-center gap-2 text-[var(--color-logo)] ${className}`}
      style={{ fontSize: textSize }}
    >
      <DuckrepMark size={mark} />
      <DuckrepWordmark className="max-[340px]:sr-only" />
    </span>
  );
}
