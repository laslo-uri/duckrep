import {
  getItem,
  getItemSync,
  initUserStore,
  removeItem,
  setItem,
} from '../../user-store/client.js';

export { getItem, getItemSync, initUserStore, removeItem, setItem };

export async function bootAppUserStore(): Promise<void> {
  await initUserStore({
    appId: 'com.youpeak.app',
    keyPrefixes: ['youpeak-', 'i18next', 'theme'],
  });
}
