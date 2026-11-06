import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';

const EDGE = 8;

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
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

  // Keep the list on screen: shift it in from the side, and open upward above the phone tab bar.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const rect = list.getBoundingClientRect();
    const overflowRight = rect.right - (document.documentElement.clientWidth - EDGE);
    if (overflowRight > 0) list.style.marginLeft = `${-overflowRight}px`;
    const tabBar = window.matchMedia('(max-width: 767px)').matches
      ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dr-tabbar-h')) || 0
      : 0;
    const bottom = window.innerHeight - tabBar - EDGE;
    if (rect.bottom > bottom && trigger && trigger.top - rect.height > EDGE) {
      list.style.top = 'auto';
      list.style.bottom = 'calc(100% + 4px)';
    } else if (rect.bottom > bottom) {
      list.scrollIntoView({ block: 'nearest' });
    }
    list.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
  }, [open]);

  const onListKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown' ? (index + 1) % items.length
        : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
          : event.key === 'Home' ? 0
            : event.key === 'End' ? items.length - 1
              : null;
    if (next == null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  const tone = compact
    ? 'border-transparent bg-transparent px-2 text-[12px] text-[var(--color-muted)] hover:border-[var(--color-border)]'
    : '';
  const ring = open ? '!border-[var(--color-accent)] shadow-[0_0_0_2px_var(--color-accent-soft)]' : '';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
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
          aria-hidden
          className={`shrink-0 text-[var(--color-faint)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          onKeyDown={onListKey}
          className="dr-enter absolute left-0 top-[calc(100%+4px)] z-30 max-h-60 min-w-full max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-pop)]"
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
                  triggerRef.current?.focus();
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
