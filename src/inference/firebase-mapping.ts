import { InferenceMode, InferenceSource } from 'firebase/ai';
import type { InferenceModeSetting, SourceLabel } from './modes';

export function toFirebaseMode(setting: InferenceModeSetting): InferenceMode {
  switch (setting) {
    case 'prefer-on-device':
      return InferenceMode.PREFER_ON_DEVICE;
    case 'only-on-device':
      return InferenceMode.ONLY_ON_DEVICE;
    case 'only-in-cloud':
      return InferenceMode.ONLY_IN_CLOUD;
  }
}

/** Anything other than the SDK's explicit ON_DEVICE value is never reported as on-device. */
export function mapInferenceSource(source: string | undefined): SourceLabel {
  if (source === InferenceSource.ON_DEVICE) return 'on-device';
  if (source === InferenceSource.IN_CLOUD) return 'cloud';
  return 'unknown';
}
