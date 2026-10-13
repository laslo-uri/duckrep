import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { StatusBar } from '@capacitor/status-bar';

/** Phone WebView chrome. No-op in the browser and the Tauri desktop shell. */
export async function configureNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    // The status bar plugin is unavailable on some webviews.
  }

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
  } catch {
    // The keyboard plugin is unavailable on some webviews.
  }
}
