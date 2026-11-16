import { PII_TYPES } from '../detection/types';
import type { CategorySettings, PresetId, PresetStore } from './types';

export const ALL_CATEGORIES_ENABLED: CategorySettings = Object.fromEntries(
  PII_TYPES.map((t) => [t, true]),
) as CategorySettings;

export const DEFAULT_PRESETS: PresetStore = {
  personal: { ...ALL_CATEGORIES_ENABLED },
  work: {
    ssn: false,
    credit_card: false,
    email: true,
    phone: true,
    api_key: true,
    iban: false,
  },
  healthcare: {
    ssn: true,
    credit_card: true,
    email: true,
    phone: true,
    api_key: false,
    iban: true,
  },
};

export const PRESET_LABELS: Record<PresetId, string> = {
  personal: 'Personal',
  work: 'Work',
  healthcare: 'Healthcare',
};

export function categoriesForPreset(
  presets: PresetStore,
  id: PresetId,
): CategorySettings {
  return { ...presets[id] };
}