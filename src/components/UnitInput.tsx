export function UnitInput({
  value,
  onChange,
  unit,
  label,
  placeholder,
  invalid = false,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  unit: string;
  label?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <span className={`relative block ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full min-h-[48px] rounded-xl border bg-[var(--color-surface)] pl-3 pr-12 text-base tabular-nums text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${
          invalid ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'
        }`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--color-muted)]"
      >
        {unit}
      </span>
    </span>
  );
}
