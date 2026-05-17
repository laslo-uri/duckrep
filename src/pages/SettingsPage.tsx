import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Check, Trash2, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toUserFriendlyError } from '../lib/authErrors';

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const pwMutation = useMutation({
    mutationFn: async () => {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPw,
      });
      if (signInErr) throw new Error(t('wrongCurrentPassword'));

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      setPwSuccess(t('passwordChanged'));
      setPwError(null);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => setPwSuccess(null), 4000);
    },
    onError: (err: Error) => {
      setPwSuccess(null);
      setPwError(toUserFriendlyError(err.message, t));
    },
  });

  const { data: trashed = [], isLoading: trashLoading } = useQuery({
    queryKey: ['trashed-activities', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_days')
        .select('id, title, date, deleted_at')
        .eq('user_id', user!.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const restoreMutation = useMutation({
    mutationFn: async (workoutDayId: string) => {
      const { error } = await supabase
        .from('workout_days')
        .update({ deleted_at: null })
        .eq('id', workoutDayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
    },
  });

  const deleteForeverMutation = useMutation({
    mutationFn: async (workoutDayId: string) => {
      const { error } = await supabase.from('workout_days').delete().eq('id', workoutDayId);
      if (error) throw error;
    },
    onSuccess: (_data, workoutDayId) => {
      queryClient.invalidateQueries({ queryKey: ['trashed-activities'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days'] });
      queryClient.invalidateQueries({ queryKey: ['workout-days-stats'] });
      queryClient.invalidateQueries({ queryKey: ['user-daily-training-stats'] });
      queryClient.removeQueries({ queryKey: ['workout', workoutDayId] });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (newPw.length < 6) {
      setPwError(t('passwordTooShort'));
      return;
    }
    if (newPw !== confirmPw) {
      setPwError(t('passwordsMustMatch'));
      return;
    }
    pwMutation.mutate();
  };

  const inputCls =
    'w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]/30';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--color-ink)]">
          {t('accountSettings')}
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1 max-w-md">{t('accountSettingsPasswordOnlyHint')}</p>
      </div>

      <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="font-medium text-[var(--color-ink)] mb-3 flex items-center gap-2">
          <Lock size={18} />
          {t('changePassword')}
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-3 max-w-xs">
          <div>
            <label className="block text-sm text-[var(--color-muted)] mb-1">{t('currentPassword')}</label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-muted)] mb-1">{t('newPassword')}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-muted)] mb-1">{t('confirmPassword')}</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          {pwError && (
            <p className="text-sm text-[var(--color-error)]" role="alert">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check size={14} /> {pwSuccess}
            </p>
          )}
          <button
            type="submit"
            disabled={pwMutation.isPending}
            className="px-4 py-2 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {pwMutation.isPending ? t('changingPassword') : t('changePassword')}
          </button>
        </form>
      </section>

      <section className="p-4 sm:p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h2 className="font-medium text-[var(--color-ink)] mb-3">{t('trashTitle')}</h2>
        {trashLoading ? (
          <p className="text-sm text-[var(--color-muted)]">{t('loading')}</p>
        ) : trashed.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t('trashEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {trashed.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-[var(--color-border)] last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-ink)] truncate">
                    {row.title || row.date}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">{row.date}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    to={`/activity/${row.id}`}
                    className="text-sm text-[var(--color-ink)] underline px-2 py-1.5"
                  >
                    {t('edit')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => restoreMutation.mutate(row.id)}
                    disabled={restoreMutation.isPending || deleteForeverMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-hover)] disabled:opacity-50"
                  >
                    <RotateCcw size={16} aria-hidden />
                    {t('restoreActivity')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(t('confirmDeleteForever'))) return;
                      deleteForeverMutation.mutate(row.id);
                    }}
                    disabled={restoreMutation.isPending || deleteForeverMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error-bg)] disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden />
                    {t('deleteForever')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
