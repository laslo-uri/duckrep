import { useTranslation } from 'react-i18next';

const LANG_CYCLE = ['en', 'sr', 'hu'] as const;

const LANG_LABEL: Record<(typeof LANG_CYCLE)[number], string> = {
  en: 'EN',
  sr: 'SR',
  hu: 'HU',
};

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation();
  // resolvedLanguage: a browser on sr-RS or hu-HU reports the regional tag in i18n.language
  const language = i18n.resolvedLanguage ?? i18n.language;
  const current = (LANG_CYCLE.includes(language as (typeof LANG_CYCLE)[number])
    ? language
    : 'en') as (typeof LANG_CYCLE)[number];
  const idx = LANG_CYCLE.indexOf(current);
  const nextLang = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(nextLang)}
      title={t('switchLanguage', { lang: LANG_LABEL[nextLang] })}
      className={`dr-btn dr-btn-ghost dr-icon-btn text-[12px] font-semibold uppercase tracking-wide ${className}`}
    >
      {LANG_LABEL[current]}
      <span className="sr-only">, {t('switchLanguage', { lang: LANG_LABEL[nextLang] })}</span>
    </button>
  );
}
