import { PII_TYPES, type PiiType } from '../detection/types';
import { DEFAULT_PRESETS } from './presets';
import {
  EMPTY_USER_OVERRIDES,
  PRESET_IDS,
  SETTINGS_VERSION,
  type AirlockSettings,
  type CategorySettings,
  type PresetId,
  type PresetStore,
  type UserOverrides,
} from './types';

export const SETTINGS_STORAGE_KEY = 'airlock_settings';

export function createDefaultSettings(): AirlockSettings {
  return {
    version: SETTINGS_VERSION,
    enabled: true,
    activePreset: 'personal',
    presets: clonePresetStore(DEFAULT_PRESETS),
    telemetryOptIn: false,
    userOverrides: { ...EMPTY_USER_OVERRIDES },
  };
}

export function clonePresetStore(store: PresetStore): PresetStore {
  return {
    personal: { ...store.personal },
    work: { ...store.work },
    healthcare: { ...store.healthcare },
  };
}

function isCategorySettings(value: unknown): value is CategorySettings {
  if (typeof value !== 'object' || value === null) return false;
  return PII_TYPES.every(
    (t) => typeof (value as Record<string, unknown>)[t] === 'boolean',
  );
}

function isPresetStore(value: unknown): value is PresetStore {
  if (typeof value !== 'object' || value === null) return false;
  return PRESET_IDS.every((id) =>
    isCategorySettings((value as Record<string, unknown>)[id]),
  );
}

function isUserOverrides(value: unknown): UserOverrides {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_USER_OVERRIDES };
  const o = value as Record<string, unknown>;
  return {
    masterEnabled: o.masterEnabled === true,
    inferenceMode: o.inferenceMode === true,
    presets: o.presets === true,
    telemetry: o.telemetry === true,
  };
}

/** Parse and migrate stored JSON; never throws — returns defaults on bad data. */
export function parseStoredSettings(raw: unknown): AirlockSettings {
  const defaults = createDefaultSettings();
  if (typeof raw !== 'object' || raw === null) return defaults;

  const obj = raw as Record<string, unknown>;
  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : defaults.enabled;
  const activePreset = PRESET_IDS.includes(obj.activePreset as PresetId)
    ? (obj.activePreset as PresetId)
    : defaults.activePreset;
  const presets = isPresetStore(obj.presets)
    ? clonePresetStore(obj.presets)
    : defaults.presets;
  const telemetryOptIn =
    typeof obj.telemetryOptIn === 'boolean' ? obj.telemetryOptIn : defaults.telemetryOptIn;
  const userOverrides = isUserOverrides(obj.userOverrides);

  return {
    version: SETTINGS_VERSION,
    enabled,
    activePreset,
    presets,
    telemetryOptIn,
    userOverrides,
  };
}

export function enabledTypesFromCategories(
  categories: CategorySettings,
): PiiType[] {
  return PII_TYPES.filter((t) => categories[t]);
}