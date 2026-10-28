import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function SelectMenu({
  label,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  className = '',
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Borderless until hovered, for use inside dense rows. */
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onPointer, true);
    };
  }, [open]);

  const tone = compact
    ? 'border-transparent bg-transparent px-2 text-[12px] text-[var(--color-muted)] hover:border-[var(--color-border)]'
    : '';
  const ring = open ? '!border-[var(--color-accent)] shadow-[0_0_0_2px_var(--color-accent-soft)]' : '';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current ? `${label}: ${current.label}` : label}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={`dr-btn w-full justify-between font-normal disabled:opacity-50 ${tone} ${ring}`}
      >
        <span className="truncate">{current?.label ?? label}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-[var(--color-faint)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="dr-enter absolute left-0 top-[calc(100%+4px)] z-30 max-h-60 min-w-full overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-pop)]"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value || 'empty'}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`dr-tap block w-full whitespace-nowrap rounded-md px-2 py-1 text-left text-[13px] text-[var(--color-ink)] hover:bg-[var(--color-hover)] ${
                  selected ? 'bg-[var(--color-active)] font-medium' : ''
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
