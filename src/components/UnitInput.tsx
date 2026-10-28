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
        className={`dr-input h-9 max-md:h-11 w-full pr-12 tabular-nums ${
          invalid ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'
        }`}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-[var(--color-faint)]"
      >
        {unit}
      </span>
    </span>
  );
}
