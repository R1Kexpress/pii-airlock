import type { PiiType } from '../detection/types';

export const SETTINGS_VERSION = 1 as const;

export const PRESET_IDS = ['personal', 'work', 'healthcare'] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export type CategorySettings = Record<PiiType, boolean>;

export type PresetStore = Record<PresetId, CategorySettings>;

export interface AirlockSettings {
  version: typeof SETTINGS_VERSION;
  enabled: boolean;
  activePreset: PresetId;
  presets: PresetStore;
}