import { MessageType, isExtensionMessage } from '../messaging/types';
import { createEmptyLedger } from '../session/ledger';
import type { PopupViewModel } from './popup-view';
import { renderPopupShell } from './popup-view';

const app = document.getElementById('app');

function paint(model: PopupViewModel): void {
  if (!app) return;
  app.innerHTML = renderPopupShell(model);

  if (model.viewState !== 'ready') return;

  const toggle = document.getElementById('enabled-toggle') as HTMLInputElement | null;
  toggle?.addEventListener('change', () => {
    void chrome.runtime.sendMessage(
      { type: MessageType.SET_ENABLED, enabled: toggle.checked },
      (response: unknown) => {
        if (chrome.runtime.lastError || !isExtensionMessage(response)) {
          toggle.checked = !toggle.checked;
          return;
        }
        if (response.type === MessageType.POPUP_STATE) {
          paint({
            viewState: 'ready',
            statusText: 'Extension connected',
            enabled: response.enabled,
            inferenceMode: response.inferenceMode,
            ledger: response.ledger,
            activePreset: response.activePreset,
          });
        }
      },
    );
  });

  document.getElementById('open-options')?.addEventListener('click', (e) => {
    e.preventDefault();
    void chrome.runtime.openOptionsPage();
  });
}

function load(): void {
  paint({
    viewState: 'loading',
    statusText: 'Checking…',
    enabled: true,
    inferenceMode: 'unknown',
    ledger: createEmptyLedger(),
    activePreset: 'personal',
  });

  chrome.runtime.sendMessage({ type: MessageType.GET_POPUP_STATE }, (response: unknown) => {
    if (chrome.runtime.lastError) {
      paint({
        viewState: 'error',
        statusText: 'Background unavailable',
        enabled: false,
        inferenceMode: 'unknown',
        ledger: createEmptyLedger(),
        activePreset: 'personal',
        errorMessage: 'Background unavailable',
      });
      return;
    }
    if (isExtensionMessage(response) && response.type === MessageType.POPUP_STATE) {
      paint({
        viewState: 'ready',
        statusText: 'Extension connected',
        enabled: response.enabled,
        inferenceMode: response.inferenceMode,
        ledger: response.ledger,
        activePreset: response.activePreset,
      });
      return;
    }
    paint({
      viewState: 'error',
      statusText: 'Unexpected response',
      enabled: false,
      inferenceMode: 'unknown',
      ledger: createEmptyLedger(),
      activePreset: 'personal',
      errorMessage: 'Unexpected response',
    });
  });
}

load();