import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2 } from 'lucide-react';
import type { ExerciseSet } from '../../types';
import { parseOptionalFloat, parseOptionalInt } from '../../utils/numbers';

export function SetRow({
  set,
  bodyWeightKg,
  isDropSet,
  onToggle,
  onUpdate,
  onDelete,
}: {
  set: ExerciseSet;
  bodyWeightKg: number | null;
  isDropSet: boolean;
  onToggle: () => void;
  onUpdate: (reps: number | null, weight: number | null, notes: string | null) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const server = {
    reps: String(set.reps ?? ''),
    weight: String(set.weight ?? ''),
    notes: set.notes ?? '',
  };
  const [draft, setDraft] = useState<{ reps: string; weight: string; notes: string } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const draftMatchesServer =
    draft != null &&
    draft.reps === server.reps &&
    draft.weight === server.weight &&
    draft.notes === server.notes;
  const activeDraft = draftMatchesServer ? null : draft;

  const reps = activeDraft?.reps ?? server.reps;
  const weight = activeDraft?.weight ?? server.weight;
  const notes = activeDraft?.notes ?? server.notes;
  const showNotes = notesOpen || Boolean(set.notes);
  const completed = set.completed;

  const patch = (partial: Partial<{ reps: string; weight: string; notes: string }>) => {
    setDraft({ reps, weight, notes, ...partial });
  };

  const flush = () => {
    const r = parseOptionalInt(reps);
    const w = parseOptionalFloat(weight);
    const trimmedNotes = notes.trim();
    if (r !== set.reps || w !== set.weight || trimmedNotes !== (set.notes ?? '')) {
      onUpdate(r, w, trimmedNotes || null);
    }
  };

  const fieldClass =
    'w-14 sm:w-16 h-11 px-2 text-center text-base tabular-nums rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] touch-manipulation';

  return (
    <div
      className={`dr-stagger rounded-xl px-2 py-1.5 transition-colors duration-300 ${
        completed ? 'bg-[var(--color-mint-soft)]' : ''
      }`}
      style={{ ['--i' as string]: Math.min(set.set_number, 5) }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <button
          type="button"
          onClick={() => {
            flush();
            onToggle();
          }}
          aria-label={completed ? t('setIncomplete') : t('setCompleted')}
          aria-pressed={completed}
          className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
        >
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
              completed
                ? 'dr-pop dr-glow-mint bg-[var(--color-mint)] border-[var(--color-mint)] text-[var(--color-on-mint)]'
                : 'border-[var(--color-border)] text-transparent'
            }`}
          >
            <Check size={16} strokeWidth={2.5} />
          </span>
        </button>
        <span
          className={`text-xs font-medium w-5 tabular-nums text-center transition-colors duration-300 ${
            completed ? 'text-[var(--color-mint)] font-bold' : 'text-[var(--color-muted)]'
          }`}
        >
          {set.set_number}
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={reps}
          onChange={(e) => patch({ reps: e.target.value })}
          onBlur={flush}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder={t('reps')}
          aria-label={t('reps')}
          className={fieldClass}
        />
        <span className="text-[var(--color-muted)] text-sm" aria-hidden>
          ×
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={weight}
          onChange={(e) => patch({ weight: e.target.value })}
          onBlur={flush}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder={isDropSet && bodyWeightKg ? String(bodyWeightKg) : t('weight')}
          aria-label={t('weight')}
          className={fieldClass}
        />
        <span className="inline-flex items-center h-11 text-xs text-[var(--color-muted)] shrink-0">{t('unitKg')}</span>
        {!showNotes && (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="inline-flex items-center text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)] px-1 min-h-[44px] touch-manipulation"
          >
            {t('setNote')}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('deleteSet')}
          className="ml-auto p-2.5 min-w-[44px] min-h-[44px] rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] touch-manipulation flex items-center justify-center"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {showNotes && (
        <input
          type="text"
          value={notes}
          onChange={(e) => patch({ notes: e.target.value })}
          onBlur={flush}
          placeholder={t('setNotesPlaceholder')}
          aria-label={t('notes')}
          className="mt-2 w-full px-3 h-11 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-paper)] text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      )}
    </div>
  );
}
