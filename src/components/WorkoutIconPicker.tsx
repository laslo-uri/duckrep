import { createElement, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WORKOUT_DAY_ICONS } from '../types';
import { getWorkoutIcon, WORKOUT_ICON_MAP } from '../utils/workoutIcons';

export function WorkoutDayIcon({
  iconKey,
  size = 20,
  className,
  fallbackToFirst = false,
}: {
  iconKey: string | null;
  size?: number;
  className?: string;
  /** When true, show first icon (dumbbell) if iconKey is null */
  fallbackToFirst?: boolean;
}) {
  const Icon = getWorkoutIcon(iconKey) ?? (fallbackToFirst ? WORKOUT_ICON_MAP.dumbbell : null);
  if (!Icon) return null;
  return createElement(Icon, { size, className });
}

/** Compact button: shows selected icon only. Click opens popover to pick. */
export function WorkoutIconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (icon: string | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handlePointerDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handlePointerDown, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    const pop = popoverRef.current;
    if (!open || !pop) return;
    pop.style.marginLeft = '0px';
    const rect = pop.getBoundingClientRect();
    const overflowRight = rect.right - (window.innerWidth - 8);
    const overflowLeft = 8 - rect.left;
    if (overflowRight > 0) pop.style.marginLeft = `${-overflowRight}px`;
    else if (overflowLeft > 0) pop.style.marginLeft = `${overflowLeft}px`;
  }, [open]);

  const handleSelect = (icon: string | null) => {
    onChange(icon);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const iconLabel = (key: string) => t(`activityIcons.${key}`, { defaultValue: key });

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title={t('activityIcon')}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="workout-icon-listbox"
        className="dr-btn dr-icon-btn"
      >
        {value ? (
          (() => {
            const Icon = getWorkoutIcon(value);
            return Icon ? createElement(Icon, { size: 15 }) : <Settings2 size={15} className="text-[var(--color-muted)]" />;
          })()
        ) : (
          <Settings2 size={15} className="text-[var(--color-muted)]" />
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          id="workout-icon-listbox"
          role="listbox"
          aria-label={t('activityIcon')}
          className="dr-enter absolute right-0 md:left-auto top-full mt-1 z-50 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] w-[min(17.5rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="dr-label mb-2">{t('activityIcon')}</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => handleSelect(null)}
              aria-label={t('noIcon')}
              className={`flex items-center justify-center dr-tap-w dr-tap rounded-md border-2 transition-colors touch-manipulation ${
                value === null
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/40'
              }`}
            >
              <span className="text-[var(--color-muted)] text-xs">—</span>
            </button>
            {WORKOUT_DAY_ICONS.map((key) => {
              const Icon = WORKOUT_ICON_MAP[key];
              const isSelected = value === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(key)}
                  aria-label={iconLabel(key)}
                  className={`flex items-center justify-center dr-tap-w dr-tap rounded-md border-2 transition-colors touch-manipulation ${
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/40 text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
