/** Hybrid inference mode — wired by the Firebase slice; UI reads via messaging. */

export const INFERENCE_MODES = [
  'on-device',
  'cloud',
  'offline',
  'unknown',
] as const;

export type InferenceMode = (typeof INFERENCE_MODES)[number];

export const INFERENCE_MODE_LABELS: Record<InferenceMode, string> = {
  'on-device': 'On-device',
  cloud: 'Cloud',
  offline: 'Offline',
  unknown: 'Unknown',
};

export function isInferenceMode(value: unknown): value is InferenceMode {
  return (
    typeof value === 'string' &&
    (INFERENCE_MODES as readonly string[]).includes(value)
  );
}