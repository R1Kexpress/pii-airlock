import type { InferenceModeSetting } from '../inference/modes';
import type { RemotePolicy } from '../firebase/policy-keys';
import { clonePresetStore } from './storage';
import type { AirlockSettings, PresetId } from './types';
import { PRESET_IDS } from './types';

export interface EffectiveAirlockConfig {
  settings: AirlockSettings;
  inferenceMode: InferenceModeSetting;
}

/**
 * Applies operator policy from Remote Config without overriding choices the user explicitly saved.
 * Kill switch always disables protection when true.
 */
export function applyRemotePolicy(
  settings: AirlockSettings,
  policy: RemotePolicy,
  inferenceMode: InferenceModeSetting,
): EffectiveAirlockConfig {
  let nextSettings: AirlockSettings = { ...settings, presets: clonePresetStore(settings.presets) };
  let nextMode = inferenceMode;

  if (policy.killSwitch) {
    nextSettings = { ...nextSettings, enabled: false };
  }

  if (!nextSettings.userOverrides.inferenceMode) {
    nextMode = policy.defaultInferenceMode;
  }

  if (!nextSettings.userOverrides.presets) {
    nextSettings = {
      ...nextSettings,
      presets: clonePresetStore(policy.presets),
    };
  }

  return { settings: nextSettings, inferenceMode: nextMode };
}

/** For tests / console verification. */
export function listRemoteControlledPresets(overrides: AirlockSettings['userOverrides']): PresetId[] {
  return overrides.presets ? [] : [...PRESET_IDS];
}