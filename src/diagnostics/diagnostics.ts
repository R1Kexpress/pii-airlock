import { initFirebase } from '../firebase/init';
import { collectDiagnostics } from '../inference/host';
import { warmUpOnDeviceModel } from '../inference/hybrid-model';
import {
  INFERENCE_MODE_SETTINGS,
  MODE_LABELS,
  SOURCE_LABELS,
  isInferenceModeSetting,
  type InferenceModeSetting,
} from '../inference/modes';
import {
  InferenceMessageType,
  type DiagnosticsResponse,
  type ModelDetectResponse,
} from '../inference/messages';
import { getModeSetting, setModeSetting } from '../inference/settings';

/** Synthetic sample, not user data. */
const SAMPLE_TEXT = 'Please email jane.roe@example.com or call 555-010-0199 about invoice 42.';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const sample = el<HTMLTextAreaElement>('sample');
const modeSelect = el<HTMLSelectElement>('mode');
sample.value = SAMPLE_TEXT;

for (const value of INFERENCE_MODE_SETTINGS) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = MODE_LABELS[value];
  modeSelect.append(option);
}
void getModeSetting().then((mode) => {
  modeSelect.value = mode;
});
modeSelect.addEventListener('change', () => {
  if (isInferenceModeSetting(modeSelect.value)) void setModeSetting(modeSelect.value);
});

el('warm-up').addEventListener('click', async () => {
  const out = el('warm-out');
  const progress = el<HTMLProgressElement>('warm-progress');
  progress.hidden = false;
  out.textContent = 'Initializing...';
  try {
    const { ai, cloudModel } = initFirebase();
    await warmUpOnDeviceModel(ai, cloudModel, (value) => {
      progress.value = value;
    });
    out.textContent = 'initializeDeviceModel resolved. Run the context checks to confirm availability.';
  } catch (error) {
    out.textContent = `initializeDeviceModel failed: ${error instanceof Error ? error.name : 'error'}`;
  }
});

el('check-here').addEventListener('click', async () => {
  el('check-out').textContent = JSON.stringify(await collectDiagnostics('extension-page'), null, 2);
});

el('check-host').addEventListener('click', async () => {
  const response = (await chrome.runtime.sendMessage({
    type: InferenceMessageType.MODEL_DIAGNOSTICS,
  })) as DiagnosticsResponse | undefined;
  el('check-out').textContent = JSON.stringify(response ?? { ok: false }, null, 2);
});

el('run').addEventListener('click', async () => {
  const out = el('run-out');
  out.textContent = 'Running...';
  const mode: InferenceModeSetting = isInferenceModeSetting(modeSelect.value)
    ? modeSelect.value
    : 'prefer-on-device';
  const response = (await chrome.runtime.sendMessage({
    type: InferenceMessageType.MODEL_DETECT,
    text: sample.value,
    mode,
  })) as ModelDetectResponse | undefined;

  if (!response) {
    out.textContent = 'No response from service worker.';
    return;
  }
  const lines = [
    `requested mode: ${mode}`,
    `ran on: ${response.run ? SOURCE_LABELS[response.run.source] : 'n/a'}`,
    `attempt sources: ${response.run?.attemptSources.join(', ') || 'none'}`,
    response.ok ? `spans: ${response.spans.length}` : `error: ${response.errorCode}`,
  ];
  if (response.run?.onDeviceViolation) {
    lines.push('WARNING: on-device only requested but on-device did not run.');
  }
  if (response.ok) {
    for (const span of response.spans) {
      lines.push(`  ${span.type} [${span.start}, ${span.end}) conf ${span.confidence}`);
    }
  }
  out.textContent = lines.join('\n');
});
