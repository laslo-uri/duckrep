import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, MessageSquare, Trash2 } from 'lucide-react';
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
  const showNotesOnPhone = notesOpen || Boolean(set.notes);
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
    'dr-input px-1 text-center tabular-nums md:h-7 bg-[var(--color-hover)] border-transparent hover:border-[var(--color-border)]';

  const notesInput = (className: string) => (
    <input
      type="text"
      value={notes}
      onChange={(e) => patch({ notes: e.target.value })}
      onBlur={flush}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      placeholder={t('setNotesPlaceholder')}
      aria-label={t('notes')}
      className={`dr-input min-w-0 border-transparent bg-transparent text-[12px] hover:border-[var(--color-border)] ${className}`}
    />
  );

  return (
    <div
      className={`group border-b border-[var(--color-border)] last:border-b-0 transition-colors duration-200 ${
        completed ? 'bg-[var(--color-mint-soft)]' : 'hover:bg-[var(--color-hover)]'
      }`}
    >
      <div className="flex min-h-9 items-center gap-2 px-3 max-md:min-h-[52px]">
        <button
          type="button"
          onClick={() => {
            flush();
            onToggle();
          }}
          aria-label={completed ? t('setIncomplete') : t('setCompleted')}
          aria-pressed={completed}
          className="dr-tap dr-tap-w -mx-1.5 flex shrink-0 items-center justify-center touch-manipulation md:-mx-1 md:w-8"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] transition-colors max-md:h-7 max-md:w-7 ${
              completed
                ? 'dr-pop border-[var(--color-mint)] bg-[var(--color-mint)] text-[var(--color-on-mint)]'
                : 'border-[var(--color-line-strong)] text-transparent hover:border-[var(--color-mint)]'
            }`}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        </button>
        <span
          className={`w-5 shrink-0 text-center text-[12px] tabular-nums ${
            completed ? 'font-semibold text-[var(--color-success)]' : 'text-[var(--color-faint)]'
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
          className={`${fieldClass} w-14 shrink-0`}
        />
        <span className="w-3 shrink-0 text-center text-[12px] text-[var(--color-faint)]" aria-hidden>
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
          className={`${fieldClass} w-16 shrink-0`}
        />
        {/* Notes sit inline from sm up; phones open them on demand under the row. */}
        {notesInput('hidden flex-1 sm:block')}
        <span className="flex-1 sm:hidden" />
        {!showNotesOnPhone && (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            aria-label={t('setNote')}
            title={t('setNote')}
            className="dr-btn dr-btn-ghost dr-icon-btn shrink-0 sm:hidden"
          >
            <MessageSquare size={14} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('deleteSet')}
          title={t('deleteSet')}
          className="dr-btn dr-btn-ghost dr-icon-btn shrink-0 hover:!text-[var(--color-error)] md:h-6 md:w-6 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>
      {showNotesOnPhone && <div className="px-3 pb-2 sm:hidden">{notesInput('w-full')}</div>}
    </div>
  );
}
