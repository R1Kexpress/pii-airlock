import { MessageType, isExtensionMessage } from '../messaging/types';

function pingBackground(): void {
  chrome.runtime.sendMessage({ type: MessageType.PING }, (response: unknown) => {
    if (chrome.runtime.lastError) return;
    if (!isExtensionMessage(response) || response.type !== MessageType.PONG) return;
    // Connected; interception wiring comes in a later slice.
  });
}

pingBackground();