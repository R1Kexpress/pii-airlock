import type { PiiType } from '../detection/types';

export const SETTINGS_VERSION = 2 as const;

export const PRESET_IDS = ['personal', 'work', 'healthcare'] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export type CategorySettings = Record<PiiType, boolean>;

export type PresetStore = Record<PresetId, CategorySettings>;

/** Tracks explicit user choices so Remote Config policy does not overwrite them. */
export interface UserOverrides {
  masterEnabled: boolean;
  inferenceMode: boolean;
  presets: boolean;
  telemetry: boolean;
}

export const EMPTY_USER_OVERRIDES: UserOverrides = {
  masterEnabled: false,
  inferenceMode: false,
  presets: false,
  telemetry: false,
};

export interface AirlockSettings {
  version: typeof SETTINGS_VERSION;
  enabled: boolean;
  activePreset: PresetId;
  presets: PresetStore;
  /** Opt-in anonymous counters; default off. */
  telemetryOptIn: boolean;
  userOverrides: UserOverrides;
}