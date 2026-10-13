import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function SelectMenu({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
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

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current ? `${label}: ${current.label}` : label}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={`yp-press inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm disabled:opacity-50 ${
          open
            ? 'border-transparent bg-[var(--color-paper)] text-[var(--color-ink)] ring-2 ring-[var(--color-accent)]'
            : 'border-[var(--color-border)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-hover)]'
        }`}
      >
        <span className="truncate">{current?.label ?? label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[var(--color-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-52 min-w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] p-1 shadow-[var(--shadow-card)]"
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
                className={`yp-press block min-h-[40px] w-full whitespace-nowrap rounded-lg px-3 text-left text-sm ${
                  selected
                    ? 'bg-[var(--color-accent)] font-semibold text-[var(--color-on-accent)]'
                    : 'text-[var(--color-ink)] hover:bg-[var(--color-hover)]'
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
