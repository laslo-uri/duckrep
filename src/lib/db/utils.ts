export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Convert `?` placeholders to `$1, $2, …` for tauri-plugin-sql. */
export function toTauriParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Local calendar day as `YYYY-MM-DD`. UTC `toISOString()` shifts the day near midnight. */
export function localDateKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayIso(now: Date = new Date()): string {
  return localDateKey(now);
}
