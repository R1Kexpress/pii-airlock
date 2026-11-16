import { detectPiiRegex } from '../detection/regex';
import {
  type ExtensionMessage,
  MessageType,
  isExtensionMessage,
} from '../messaging/types';
import {
  ensureDefaultSettings,
  getInferenceMode,
  loadLedger,
  loadSettings,
  recordLedgerIncrements,
  saveSettings,
  setEnabled,
  setInferenceMode,
} from './state';

void ensureDefaultSettings();

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender,
    sendResponse: (response: ExtensionMessage) => void,
  ) => {
    if (!isExtensionMessage(message)) return;

    const handle = async (): Promise<void> => {
      switch (message.type) {
        case MessageType.PING:
          sendResponse({
            type: MessageType.PONG,
            from: 'service-worker',
          });
          return;
        case MessageType.DETECT_PII:
          sendResponse({
            type: MessageType.DETECT_PII_RESULT,
            spanCount: 0,
            ok: true,
          });
          return;
        case MessageType.GET_POPUP_STATE: {
          const [settings, ledger, mode] = await Promise.all([
            loadSettings(),
            loadLedger(),
            getInferenceMode(),
          ]);
          sendResponse({
            type: MessageType.POPUP_STATE,
            connected: true,
            enabled: settings.enabled,
            inferenceMode: mode,
            ledger,
            activePreset: settings.activePreset,
          });
          return;
        }
        case MessageType.SET_ENABLED: {
          const settings = await setEnabled(message.enabled);
          sendResponse({
            type: MessageType.POPUP_STATE,
            connected: true,
            enabled: settings.enabled,
            inferenceMode: await getInferenceMode(),
            ledger: await loadLedger(),
            activePreset: settings.activePreset,
          });
          return;
        }
        case MessageType.GET_SETTINGS: {
          sendResponse({
            type: MessageType.SETTINGS,
            settings: await loadSettings(),
          });
          return;
        }
        case MessageType.SAVE_SETTINGS: {
          await saveSettings(message.settings);
          sendResponse({
            type: MessageType.SAVE_SETTINGS_RESULT,
            ok: true,
          });
          return;
        }
        case MessageType.SET_INFERENCE_MODE: {
          await setInferenceMode(message.mode);
          sendResponse({
            type: MessageType.PONG,
            from: 'service-worker',
          });
          return;
        }
        case MessageType.RECORD_LEDGER: {
          await recordLedgerIncrements(message.increments);
          sendResponse({
            type: MessageType.PONG,
            from: 'service-worker',
          });
          return;
        }
        default:
          break;
      }
    };

    void handle();
    return true;
  },
);

/** Reserved for popup/options triggering detection without logging input. */
export function runDetectionInWorker(text: string): number {
  return detectPiiRegex(text).length;
}