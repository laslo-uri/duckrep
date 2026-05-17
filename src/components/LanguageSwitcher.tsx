import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <button
      onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'sr' : 'en')}
      className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] px-4 py-2.5 min-h-[44px] rounded-lg hover:bg-[var(--color-hover)] transition-colors uppercase tracking-wide touch-manipulation"
    >
      {i18n.language === 'en' ? 'SR' : 'EN'}
    </button>
  );
}
