import { useTranslation } from 'react-i18next';

const LANG_CYCLE = ['en', 'sr', 'hu'] as const;

const LANG_LABEL: Record<(typeof LANG_CYCLE)[number], string> = {
  en: 'EN',
  sr: 'SR',
  hu: 'HU',
};

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (LANG_CYCLE.includes(i18n.language as (typeof LANG_CYCLE)[number])
    ? i18n.language
    : 'en') as (typeof LANG_CYCLE)[number];
  const idx = LANG_CYCLE.indexOf(current);
  const nextLang = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(nextLang)}
      title={t('switchLanguage', { lang: LANG_LABEL[nextLang] })}
      className="dr-press text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] px-2.5 py-2.5 min-h-[44px] min-w-[44px] rounded-lg hover:bg-[var(--color-hover)] uppercase tracking-wide touch-manipulation"
    >
      {LANG_LABEL[current]}
      <span className="sr-only">, {t('switchLanguage', { lang: LANG_LABEL[nextLang] })}</span>
    </button>
  );
}
