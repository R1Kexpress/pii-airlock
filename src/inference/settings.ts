import {
  DEFAULT_INFERENCE_MODE,
  type InferenceModeSetting,
  type InferenceRunReport,
  isInferenceModeSetting,
} from './modes';

const MODE_KEY = 'inferenceMode';
const LAST_RUN_KEY = 'lastInferenceRun';

export const SETTINGS_KEYS = { MODE_KEY, LAST_RUN_KEY } as const;

/** Mode is a preference (not prompt data), so it is kept in chrome.storage.local. */
export async function getModeSetting(): Promise<InferenceModeSetting> {
  const stored = await chrome.storage.local.get(MODE_KEY);
  const value: unknown = stored[MODE_KEY];
  return isInferenceModeSetting(value) ? value : DEFAULT_INFERENCE_MODE;
}

export async function setModeSetting(mode: InferenceModeSetting): Promise<void> {
  await chrome.storage.local.set({ [MODE_KEY]: mode });
}

/** Run reports contain no prompt text; session storage keeps them off disk. */
export async function saveLastRun(run: InferenceRunReport): Promise<void> {
  await chrome.storage.session.set({ [LAST_RUN_KEY]: run });
}

export async function getLastRun(): Promise<InferenceRunReport | undefined> {
  const stored = await chrome.storage.session.get(LAST_RUN_KEY);
  const value: unknown = stored[LAST_RUN_KEY];
  return typeof value === 'object' && value !== null ? (value as InferenceRunReport) : undefined;
}
