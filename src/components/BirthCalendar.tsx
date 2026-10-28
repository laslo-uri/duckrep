import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { todayIso } from '../lib/db';
import { appLocale } from '../lib/locale';

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function BirthCalendar({
  value,
  onChange,
  className = '',
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const today = todayIso();
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [openMenu, setOpenMenu] = useState<'month' | 'year' | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);
  const locale = appLocale(i18n.resolvedLanguage || i18n.language);
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, index + 1)),
  );
  const firstWeekday = (new Date(cursor.year, cursor.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const now = new Date();
  const atCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const atOldest = cursor.year === 1920 && cursor.month === 0;
  const years = Array.from({ length: now.getFullYear() - 1920 + 1 }, (_, index) => now.getFullYear() - index);
  const monthNames = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, index, 1)),
  );

  useEffect(() => {
    if (!openMenu) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpenMenu(null);
    }
    function onPointer(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setOpenMenu(null);
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onPointer, true);
    };
  }, [openMenu]);

  useLayoutEffect(() => {
    if (openMenu !== 'year') return;
    yearListRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, [openMenu]);

  const triggerClass = (open: boolean) =>
    `dr-press inline-flex min-h-[44px] w-full items-center justify-between gap-1 rounded-lg border px-2.5 text-sm font-medium text-[var(--color-ink)] ${
      open
        ? 'border-transparent bg-[var(--color-paper)] ring-2 ring-[var(--color-accent)]'
        : 'border-[var(--color-border)] bg-[var(--color-paper)] hover:bg-[var(--color-hover)]'
    }`;

  const optionClass = (selected: boolean, disabled = false) =>
    `dr-press min-h-[36px] rounded-lg px-2 text-sm ${
      disabled
        ? 'cursor-not-allowed text-[var(--color-muted)] opacity-35'
        : selected
          ? 'bg-[var(--color-accent)] font-semibold text-[var(--color-on-accent)]'
          : 'text-[var(--color-ink)] hover:bg-[var(--color-hover)]'
    }`;

  return (
    <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 ${className}`}>
      <div ref={headerRef} className="flex items-center gap-2">
        <button
          type="button"
          className="dr-press inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)] disabled:opacity-30"
          onClick={() =>
            setCursor((current) =>
              current.month === 0
                ? { year: current.year - 1, month: 11 }
                : { year: current.year, month: current.month - 1 },
            )
          }
          disabled={atOldest}
          aria-label={t('previousMonth')}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={openMenu === 'month'}
            onClick={() => setOpenMenu((current) => (current === 'month' ? null : 'month'))}
            className={triggerClass(openMenu === 'month')}
          >
            <span className="truncate">{monthNames[cursor.month]}</span>
            <span className="sr-only">, {t('chooseMonth')}</span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-[var(--color-muted)] transition-transform ${openMenu === 'month' ? 'rotate-180' : ''}`}
            />
          </button>
          {openMenu === 'month' ? (
            <div
              role="listbox"
              aria-label={t('chooseMonth')}
              className="absolute left-0 top-[calc(100%+6px)] z-30 grid w-[15rem] max-w-[calc(100vw-2.5rem)] grid-cols-3 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] p-1.5 shadow-[var(--shadow-card)]"
            >
              {monthNames.map((name, index) => {
                const disabled = cursor.year === now.getFullYear() && index > now.getMonth();
                return (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={index === cursor.month}
                    disabled={disabled}
                    onClick={() => {
                      setCursor((current) => ({ ...current, month: index }));
                      setOpenMenu(null);
                    }}
                    className={optionClass(index === cursor.month, disabled)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="relative w-[6.25rem] shrink-0">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={openMenu === 'year'}
            onClick={() => setOpenMenu((current) => (current === 'year' ? null : 'year'))}
            className={triggerClass(openMenu === 'year')}
          >
            <span>{cursor.year}</span>
            <span className="sr-only">, {t('chooseYear')}</span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-[var(--color-muted)] transition-transform ${openMenu === 'year' ? 'rotate-180' : ''}`}
            />
          </button>
          {openMenu === 'year' ? (
            <div
              ref={yearListRef}
              role="listbox"
              aria-label={t('chooseYear')}
              className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] p-1 shadow-[var(--shadow-card)]"
            >
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  role="option"
                  aria-selected={year === cursor.year}
                  data-selected={year === cursor.year ? 'true' : undefined}
                  onClick={() => {
                    setCursor((current) => ({
                      year,
                      month: year === now.getFullYear() ? Math.min(current.month, now.getMonth()) : current.month,
                    }));
                    setOpenMenu(null);
                  }}
                  className={`${optionClass(year === cursor.year)} w-full text-left`}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="dr-press inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)] disabled:opacity-30"
          onClick={() =>
            setCursor((current) =>
              current.month === 11
                ? { year: current.year + 1, month: 0 }
                : { year: current.year, month: current.month + 1 },
            )
          }
          disabled={atCurrentMonth}
          aria-label={t('nextMonth')}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-[var(--color-muted)]">
        {weekdays.map((label, index) => (
          <span key={index} className="py-1">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day == null) return <span key={`empty-${index}`} />;
          const iso = isoDate(cursor.year, cursor.month, day);
          const future = iso > today;
          const selected = iso === value;
          return (
            <button
              key={iso}
              type="button"
              disabled={future}
              onClick={() => onChange(selected ? '' : iso)}
              className={`dr-press min-h-[36px] rounded-lg text-sm disabled:opacity-30 ${
                selected
                  ? 'bg-[var(--color-accent)] font-semibold text-[var(--color-on-accent)]'
                  : 'text-[var(--color-ink)] hover:bg-[var(--color-hover)]'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
