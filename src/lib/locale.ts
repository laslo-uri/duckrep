/** BCP 47 tag for the app language. Serbian stays in Latin script. */
export function appLocale(language: string | undefined): string {
  const base = (language ?? 'en').split('-')[0];
  if (base === 'sr') return 'sr-Latn';
  if (base === 'hu') return 'hu';
  return 'en';
}
