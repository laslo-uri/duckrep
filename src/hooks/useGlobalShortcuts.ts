import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
};

/** Hawkdone-style keys: C starts an activity, G then J / S / E / , jumps between pages. */
export function useGlobalShortcuts(onNew: () => void) {
  const navigate = useNavigate();
  useEffect(() => {
    let pendingG = false;
    let timer: number | undefined;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const key = e.key.toLowerCase();
      if (pendingG) {
        pendingG = false;
        window.clearTimeout(timer);
        const map: Record<string, string> = { j: '/journal', s: '/stats', e: '/exercises', ',': '/settings' };
        if (map[key]) {
          e.preventDefault();
          navigate(map[key]);
        }
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        onNew();
      } else if (key === 'g') {
        pendingG = true;
        timer = window.setTimeout(() => (pendingG = false), 800);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [navigate, onNew]);
}
