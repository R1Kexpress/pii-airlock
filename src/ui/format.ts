import { PII_TYPES, type PiiType } from '../detection/types';
import type { InferenceMode } from '../inference/mode';
import { INFERENCE_MODE_LABELS } from '../inference/mode';
import { PRESET_LABELS } from '../settings/presets';
import type { PresetId } from '../settings/types';

export const PII_TYPE_LABELS: Record<PiiType, string> = {
  ssn: 'SSN',
  credit_card: 'Card',
  email: 'Email',
  phone: 'Phone',
  api_key: 'API key',
  iban: 'IBAN',
};

export function labelForPiiType(type: PiiType): string {
  return PII_TYPE_LABELS[type] ?? type;
}

export function labelForPreset(id: PresetId): string {
  return PRESET_LABELS[id] ?? id;
}

export function labelForInferenceMode(mode: InferenceMode): string {
  return INFERENCE_MODE_LABELS[mode] ?? mode;
}

export function orderedPiiTypes(): PiiType[] {
  return [...PII_TYPES];
}