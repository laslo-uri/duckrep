interface YouPeakLogoProps {
  className?: string;
  /** Icon size in px; text scales proportionally */
  size?: number;
  /** Show only the icon (no wordmark) */
  iconOnly?: boolean;
  /** 'full' = Sisyphus silhouette, 'minimal' = simplified geometric */
  variant?: 'full' | 'minimal';
  /** 'horizontal' = icon left of text; 'stacked' = icon above text (better for hero/auth) */
  layout?: 'horizontal' | 'stacked';
}

/**
 * YouPeak logo: Sisyphus pushing the boulder — the climb, the grind.
 */
export function YouPeakLogo({ className = '', size = 36, iconOnly = false, variant = 'full', layout = 'horizontal' }: YouPeakLogoProps) {
  const iconSize = layout === 'stacked' ? size * 1.2 : size;
  const textSize = size * 0.85;

  const minimalStroke = Math.max(3, (12 * iconSize) / 100);

  const fullIcon = (
    <div
      role="img"
      aria-hidden
      className="youpeak-logo-icon flex-shrink-0"
      style={{
        width: iconSize,
        height: iconSize,
        maskImage: 'url(/sisyphus.svg)',
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskImage: 'url(/sisyphus.svg)',
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        backgroundColor: 'var(--color-logo)',
      }}
    />
  );

  const minimalIcon = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={minimalStroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      shapeRendering="geometricPrecision"
      className="youpeak-logo-icon flex-shrink-0"
      aria-hidden
    >
      <path d="M10 80 L90 20" />
      <circle cx="60" cy="45" r="18" />
      <path d="M25 75 L45 50 L55 75" />
      <circle cx="45" cy="48" r="4" />
    </svg>
  );

  const isStacked = layout === 'stacked' && !iconOnly;

  return (
    <span
      className={`inline-flex font-serif font-semibold tracking-tight text-[var(--color-logo)] ${isStacked ? 'flex-col items-center gap-2' : 'items-center gap-0.5'} ${className}`}
      style={{ fontSize: textSize }}
    >
      {variant === 'full' ? fullIcon : minimalIcon}
      {!iconOnly && (
        <span className="font-serif font-semibold tracking-tight" style={{ fontSize: textSize }}>YouPeak</span>
      )}
    </span>
  );
}
