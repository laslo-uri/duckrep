import { useEffect } from 'react';

const APP_NAME = 'YouPeak';

/** Sets `document.title` to "<title> · YouPeak" while the page is mounted (plain "YouPeak" when empty). */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    const trimmed = title?.trim();
    document.title = trimmed ? `${trimmed} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
