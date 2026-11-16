import { detectPiiRegex } from '../detection/regex';
import { MessageType, isExtensionMessage } from '../messaging/types';
import {
  createPreviewPanel,
  defaultRedactMap,
} from '../preview/preview-panel';
import type { AirlockSettings, PresetId } from '../settings/types';
import { PRESET_IDS } from '../settings/types';
import { PII_TYPES, type PiiType } from '../detection/types';
import type { OptionsViewModel } from './options-view';
import { renderOptions } from './options-view';

const optionsApp = document.getElementById('options-app');
const previewHost = document.getElementById('preview-host');

let draft: AirlockSettings | null = null;

function cloneSettings(settings: AirlockSettings): AirlockSettings {
  return {
    ...settings,
    presets: {
      personal: { ...settings.presets.personal },
      work: { ...settings.presets.work },
      healthcare: { ...settings.presets.healthcare },
    },
  };
}

function paint(model: OptionsViewModel): void {
  if (!optionsApp) return;
  optionsApp.innerHTML = renderOptions(model);
  if (model.viewState !== 'ready' || !draft) return;

  optionsApp.querySelectorAll<HTMLInputElement>('input[data-preset][data-category]').forEach((input) => {
    input.addEventListener('change', () => {
      const preset = input.dataset.preset as PresetId;
      const category = input.dataset.category as PiiType;
      if (!PRESET_IDS.includes(preset) || !PII_TYPES.includes(category)) return;
      draft!.presets[preset][category] = input.checked;
    });
  });

  optionsApp.querySelectorAll<HTMLInputElement>('input[name="active-preset"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const value = input.value as PresetId;
      if (PRESET_IDS.includes(value)) draft!.activePreset = value;
    });
  });

  document.getElementById('save-settings')?.addEventListener('click', () => {
    if (!draft) return;
    void chrome.runtime.sendMessage(
      { type: MessageType.SAVE_SETTINGS, settings: draft },
      (response: unknown) => {
        if (chrome.runtime.lastError) {
          paint({
            viewState: 'error',
            errorMessage: 'Could not save settings.',
          });
          return;
        }
        if (isExtensionMessage(response) && response.type === MessageType.SAVE_SETTINGS_RESULT && response.ok) {
          paint({ viewState: 'ready', settings: draft!, savedFlash: true });
          window.setTimeout(() => {
            paint({ viewState: 'ready', settings: draft! });
          }, 1500);
        }
      },
    );
  });
}

function mountPreviewDemo(): void {
  if (!previewHost) return;
  const sampleText =
    'Please summarize: SSN 123-45-6789, card 4111 1111 1111 1111, reach me at ada@example.com.';
  const spans = detectPiiRegex(sampleText);
  let redactByIndex = defaultRedactMap(spans);
  createPreviewPanel(previewHost, {
    text: sampleText,
    spans,
    redactByIndex,
    state: 'ready',
    onRedactChange: (index, redact) => {
      redactByIndex = { ...redactByIndex, [index]: redact };
    },
    onSendProtected: () => {
      /* demo only */
    },
    onSendOriginal: () => {
      /* demo only */
    },
  });
}

function load(): void {
  paint({ viewState: 'loading' });
  chrome.runtime.sendMessage({ type: MessageType.GET_SETTINGS }, (response: unknown) => {
    if (chrome.runtime.lastError) {
      paint({ viewState: 'error', errorMessage: 'Background unavailable.' });
      return;
    }
    if (isExtensionMessage(response) && response.type === MessageType.SETTINGS) {
      draft = cloneSettings(response.settings);
      paint({ viewState: 'ready', settings: draft });
      mountPreviewDemo();
      return;
    }
    paint({ viewState: 'error', errorMessage: 'Unexpected response.' });
  });
}

load();