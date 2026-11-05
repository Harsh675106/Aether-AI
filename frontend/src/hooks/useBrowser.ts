import { useBrowserStore } from '@/stores/browserStore';
import { parseBrowserVoiceCommand } from '@/voice/browserCommands';
import { BrowserCommand } from '@/types/browser';

export function useBrowser() {
  const store = useBrowserStore();

  const handleBrowserCommand = async (message: string): Promise<boolean> => {
    const command: BrowserCommand | null = parseBrowserVoiceCommand(message);
    if (!command) return false;

    switch (command.action) {
      case 'open':
        await store.openBrowser(command.url ?? 'https://www.google.com');
        break;

      case 'navigate':
        if (store.state.isOpen) {
          await store.navigateBrowser(command.url ?? 'https://www.google.com');
        } else {
          await store.openBrowser(command.url ?? 'https://www.google.com');
        }
        break;

      case 'show':
        await store.showBrowser();
        break;

      case 'hide':
        await store.hideBrowser();
        break;

      case 'minimize':
        await store.minimizeBrowser();
        break;

      case 'maximize':
        await store.maximizeBrowser();
        break;

      case 'close':
        await store.closeBrowser();
        break;

      case 'float':
        await store.setLayout('floating');
        break;

      case 'snap':
        if (command.snapPosition) {
          await store.snapTo(command.snapPosition);
        }
        break;

      case 'always-on-top':
        if (command.alwaysOnTop !== undefined) {
          await store.setAlwaysOnTop(command.alwaysOnTop);
        }
        break;

      default:
        return false;
    }

    return true;
  };

  return {
    ...store,
    handleBrowserCommand,
  };
}
