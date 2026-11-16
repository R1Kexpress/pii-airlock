import {
  INFERENCE_MODE_SETTINGS,
  MODE_LABELS,
  SOURCE_LABELS,
  type InferenceRunReport,
  isInferenceModeSetting,
} from '../inference/modes';
import { SETTINGS_KEYS, getLastRun, getModeSetting, setModeSetting } from '../inference/settings';

const root = document.getElementById('inference-panel');

function describeRun(run: InferenceRunReport | undefined): string {
  if (!run) return 'No model run yet.';
  const where = SOURCE_LABELS[run.source];
  if (run.onDeviceViolation) {
    return `Last run: ${where}. Warning: on-device only was requested but it did not run on-device.`;
  }
  if (!run.ok) {
    return run.attemptSources.length > 0
      ? `Last run failed (${run.errorCode ?? 'error'}); backend used: ${where}.`
      : `Last run failed before any model call (${run.errorCode ?? 'error'}).`;
  }
  return `Last run: ${where}.`;
}

async function render(): Promise<void> {
  if (!root) return;
  const [mode, lastRun] = await Promise.all([getModeSetting(), getLastRun()]);

  root.replaceChildren();

  const label = document.createElement('label');
  label.textContent = 'Inference mode ';
  const select = document.createElement('select');
  for (const value of INFERENCE_MODE_SETTINGS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = MODE_LABELS[value];
    option.selected = value === mode;
    select.append(option);
  }
  select.addEventListener('change', () => {
    if (isInferenceModeSetting(select.value)) void setModeSetting(select.value);
  });
  label.append(select);

  const status = document.createElement('p');
  status.id = 'inference-status';
  status.textContent = describeRun(lastRun);

  const diagnostics = document.createElement('button');
  diagnostics.type = 'button';
  diagnostics.textContent = 'Open diagnostics';
  diagnostics.addEventListener('click', () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/diagnostics/diagnostics.html') });
  });

  root.append(label, status, diagnostics);
}

void render();

chrome.storage.onChanged.addListener((changes) => {
  if (SETTINGS_KEYS.LAST_RUN_KEY in changes || SETTINGS_KEYS.MODE_KEY in changes) void render();
});
