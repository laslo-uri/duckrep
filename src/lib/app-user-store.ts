import {
  getItem,
  getItemSync,
  initUserStore,
  removeItem,
  setItem,
} from '../../user-store/client.js';

export { getItem, getItemSync, initUserStore, removeItem, setItem };

function isLocalHost(): boolean {
  if (typeof location === 'undefined') return false;
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

export async function bootAppUserStore(): Promise<void> {
  await initUserStore({
    appId: 'com.youpeak.app',
    keyPrefixes: ['youpeak-', 'i18next', 'theme'],
    // The /api/user-store middleware only exists in `vite dev` / `vite preview`.
    // On a deployed host the request would just return index.html.
    apiPath: isLocalHost() ? '/api/user-store' : '',
  });
}
