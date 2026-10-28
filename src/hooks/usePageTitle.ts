import { useEffect } from 'react';

const APP_NAME = 'Duckrep';

/** Sets `document.title` to "<title> · Duckrep" while the page is mounted (plain "Duckrep" when empty). */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    const trimmed = title?.trim();
    document.title = trimmed ? `${trimmed} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
