import { getItemSync, setItem } from '../app-user-store';

/** Minutes without input before the journal locks itself (0 = never). Kept with the preferences, not in the vault. */
const STORAGE_KEY = 'duckrep-autolock';
const CHANGE_EVENT = 'duckrep-autolock-change';
export const AUTO_LOCK_CHOICES = [0, 5, 15, 30, 60] as const;
export const DEFAULT_AUTO_LOCK = 15;

export function getAutoLockMinutes(): number {
  const n = Number(getItemSync(STORAGE_KEY));
  return getItemSync(STORAGE_KEY) !== null && Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_AUTO_LOCK;
}

export async function setAutoLockMinutes(minutes: number): Promise<void> {
  await setItem(STORAGE_KEY, String(Math.max(0, Math.round(minutes))));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Calls `onIdle` after the chosen minutes without pointer, key or wheel input while `active`. */
export function watchIdle(onIdle: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    const minutes = getAutoLockMinutes();
    if (minutes > 0) timer = setTimeout(onIdle, minutes * 60_000);
  };
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  for (const name of events) window.addEventListener(name, arm, { passive: true });
  window.addEventListener(CHANGE_EVENT, arm);
  arm();
  return () => {
    clearTimeout(timer);
    for (const name of events) window.removeEventListener(name, arm);
    window.removeEventListener(CHANGE_EVENT, arm);
  };
}
