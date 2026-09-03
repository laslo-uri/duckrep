export function getItem(key: string): Promise<string | null>;
export function getItemSync(key: string): string | null;
export function setItem(key: string, value: string): Promise<void>;
export function removeItem(key: string): Promise<void>;
export function initUserStore(options: {
  appId: string;
  keyPrefixes?: string[];
}): Promise<void>;
