import { MessageType, isExtensionMessage } from '../messaging/types';

const statusEl = document.getElementById('status');

chrome.runtime.sendMessage({ type: MessageType.PING }, (response: unknown) => {
  if (!statusEl) return;
  if (chrome.runtime.lastError) {
    statusEl.textContent = 'Background unavailable';
    return;
  }
  if (isExtensionMessage(response) && response.type === MessageType.PONG) {
    statusEl.textContent = 'Extension connected';
    return;
  }
  statusEl.textContent = 'Unexpected response';
});