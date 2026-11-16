import { detectPiiRegex } from '../detection/regex';
import {
  type ExtensionMessage,
  MessageType,
  isExtensionMessage,
} from '../messaging/types';

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender,
    sendResponse: (response: ExtensionMessage) => void,
  ) => {
    if (!isExtensionMessage(message)) return;

    switch (message.type) {
      case MessageType.PING:
        sendResponse({
          type: MessageType.PONG,
          from: 'service-worker',
        });
        return;
      case MessageType.DETECT_PII:
        // Stub: full text arrives in a later slice; never log prompt content.
        sendResponse({
          type: MessageType.DETECT_PII_RESULT,
          spanCount: 0,
          ok: true,
        });
        return;
      default:
        break;
    }
  },
);

/** Reserved for popup/options triggering detection without logging input. */
export function runDetectionInWorker(text: string): number {
  return detectPiiRegex(text).length;
}