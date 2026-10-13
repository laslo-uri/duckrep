import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { formatScaled, searchFoods, type FoodHit } from '../lib/openFoodFacts';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { UnitInput } from './UnitInput';

type AppliedFood = {
  name: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
};

export function FoodSearch({ onApply }: { onApply: (fields: AppliedFood) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="yp-press mb-4 flex w-full min-h-[44px] items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left text-sm text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      >
        <Search size={16} aria-hidden />
        {t('foodSearchPlaceholder')}
      </button>
      {open ? (
        <FoodSearchDialog
          onClose={() => setOpen(false)}
          onApply={(fields) => {
            onApply(fields);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function FoodSearchDialog({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (fields: AppliedFood) => void;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const [grams, setGrams] = useState('100');
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const timer = useRef<number | null>(null);
  const request = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useDialogA11y({
    open: true,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: inputRef,
  });

  useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
      abortRef.current?.abort();
    };
  }, []);

  const amount = Number(grams.replace(',', '.'));
  const gramsOk = Number.isFinite(amount) && amount > 0;

  const search = (value: string) => {
    setQuery(value);
    setPicked(null);
    if (timer.current != null) window.clearTimeout(timer.current);
    const term = value.trim();
    if (term.length < 2) {
      abortRef.current?.abort();
      setHits([]);
      setStatus('idle');
      return;
    }
    timer.current = window.setTimeout(() => {
      const id = request.current + 1;
      request.current = id;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('loading');
      void searchFoods(term, controller.signal)
        .then((next) => {
          if (request.current !== id) return;
          setHits(next);
          setStatus(next.length === 0 ? 'empty' : 'idle');
        })
        .catch((error: unknown) => {
          if (request.current !== id || isAbort(error)) return;
          setHits([]);
          setStatus('error');
        });
    }, 300);
  };

  const usePicked = () => {
    if (!picked || !gramsOk) return;
    onApply({
      name: picked.brand ? `${picked.name} (${picked.brand})` : picked.name,
      kcal: formatScaled(picked.kcal100, amount, 0),
      protein: formatScaled(picked.protein100, amount, 1),
      carbs: formatScaled(picked.carbs100, amount, 1),
      fat: formatScaled(picked.fat100, amount, 1),
    });
  };

  const preview = picked && gramsOk ? macroPreview(picked, amount, t) : '';

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t('dismiss')}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="food-search-title"
        className="yp-enter relative flex max-h-[min(40rem,92dvh)] w-full flex-col rounded-t-2xl bg-[var(--color-surface)] shadow-[var(--shadow-card)] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 id="food-search-title" className="font-serif text-xl font-semibold text-[var(--color-ink)]">
              {t('foodSearchTitle')}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{t('foodSearchHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('dismiss')}
            className="yp-press flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => search(event.target.value)}
              placeholder={t('foodSearchPlaceholder')}
              aria-label={t('foodSearchPlaceholder')}
              className="w-full min-h-[48px] rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] pl-10 pr-3 text-base text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="mt-3 min-h-48 flex-1 overflow-y-auto px-3 pb-3" aria-busy={status === 'loading'}>
          {status === 'loading' ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--color-muted)]">{t('foodSearchLoading')}</p>
          ) : null}
          {status === 'error' ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--color-error)]" role="alert">
              {t('foodSearchFailed')}
            </p>
          ) : null}
          {status === 'empty' ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--color-muted)]">{t('foodSearchEmpty')}</p>
          ) : null}
          {status === 'idle' && query.trim().length === 1 ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--color-muted)]">{t('foodSearchMin')}</p>
          ) : null}
          {hits.length > 0 ? (
            <ul className="space-y-1">
              {hits.map((hit) => {
                const selected = picked?.code === hit.code;
                return (
                  <li key={hit.code}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(hit);
                        setGrams('100');
                      }}
                      aria-pressed={selected}
                      className={`yp-press flex w-full min-h-[56px] items-center gap-3 rounded-xl px-2 text-left ${
                        selected ? 'bg-[var(--color-accent-soft)]' : 'hover:bg-[var(--color-hover)]'
                      }`}
                    >
                      {hit.image ? (
                        <img src={hit.image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="h-11 w-11 shrink-0 rounded-lg bg-[var(--color-hover)]" aria-hidden />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--color-ink)]">{hit.name}</span>
                        <span className="block truncate text-xs text-[var(--color-muted)]">
                          {[
                            hit.brand,
                            hit.kcal100 != null ? t('foodPer100', { kcal: Math.round(hit.kcal100) }) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {picked ? (
          <div className="border-t border-[var(--color-border)] px-5 py-4">
            <p className="truncate text-sm font-medium text-[var(--color-ink)]">
              {picked.brand ? `${picked.name} (${picked.brand})` : picked.name}
            </p>
            <div className="mt-3 flex items-end gap-2">
              <UnitInput
                value={grams}
                onChange={setGrams}
                unit="g"
                label={t('foodGrams')}
                placeholder="100"
                invalid={!gramsOk}
                className="w-32 shrink-0"
              />
              <button
                type="button"
                onClick={usePicked}
                disabled={!gramsOk}
                className="yp-press min-h-[48px] flex-1 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-on-accent)] disabled:opacity-50"
              >
                {t('foodSearchUse')}
              </button>
            </div>
            {preview ? (
              <p className="mt-3 text-sm tabular-nums text-[var(--color-muted)]">{preview}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isAbort(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';
}

function macroPreview(
  hit: FoodHit,
  grams: number,
  t: (key: string) => string,
): string {
  const parts: string[] = [];
  const kcal = formatScaled(hit.kcal100, grams, 0);
  const protein = formatScaled(hit.protein100, grams, 1);
  const carbs = formatScaled(hit.carbs100, grams, 1);
  const fat = formatScaled(hit.fat100, grams, 1);
  if (kcal) parts.push(`${kcal} kcal`);
  if (protein) parts.push(`${protein} g ${t('protein').toLowerCase()}`);
  if (carbs) parts.push(`${carbs} g ${t('carbs').toLowerCase()}`);
  if (fat) parts.push(`${fat} g ${t('fat').toLowerCase()}`);
  return parts.join(' · ');
}
