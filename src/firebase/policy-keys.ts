import { DEFAULT_PRESETS } from '../settings/presets';
import { DEFAULT_INFERENCE_MODE, type InferenceModeSetting } from '../inference/modes';
import type { PresetId, PresetStore } from '../settings/types';
import { PRESET_IDS } from '../settings/types';

/** Remote Config parameter names (publish matching keys in Firebase console). */
export const REMOTE_POLICY_STORAGE_KEY = 'airlock_remote_policy_cache';

export const REMOTE_CONFIG_KEYS = {
  killSwitch: 'airlock_kill_switch',
  defaultInferenceMode: 'airlock_default_inference_mode',
  categoriesPersonal: 'airlock_categories_personal',
  categoriesWork: 'airlock_categories_work',
  categoriesHealthcare: 'airlock_categories_healthcare',
} as const;

export interface RemotePolicy {
  killSwitch: boolean;
  defaultInferenceMode: InferenceModeSetting;
  presets: PresetStore;
}

export const LOCAL_DEFAULT_POLICY: RemotePolicy = {
  killSwitch: false,
  defaultInferenceMode: DEFAULT_INFERENCE_MODE,
  presets: {
    personal: { ...DEFAULT_PRESETS.personal },
    work: { ...DEFAULT_PRESETS.work },
    healthcare: { ...DEFAULT_PRESETS.healthcare },
  },
};

/** Strings used as `defaultConfig` for Remote Config (offline / pre-fetch). */
export function remoteConfigDefaultStrings(): Record<string, string> {
  const entries: Record<string, string> = {
    [REMOTE_CONFIG_KEYS.killSwitch]: 'false',
    [REMOTE_CONFIG_KEYS.defaultInferenceMode]: LOCAL_DEFAULT_POLICY.defaultInferenceMode,
  };
  for (const id of PRESET_IDS) {
    const key = categoriesKeyForPreset(id);
    entries[key] = JSON.stringify(LOCAL_DEFAULT_POLICY.presets[id]);
  }
  return entries;
}

export function categoriesKeyForPreset(id: PresetId): string {
  switch (id) {
    case 'personal':
      return REMOTE_CONFIG_KEYS.categoriesPersonal;
    case 'work':
      return REMOTE_CONFIG_KEYS.categoriesWork;
    case 'healthcare':
      return REMOTE_CONFIG_KEYS.categoriesHealthcare;
  }
}