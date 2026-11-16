/** User-facing mode setting. Persisted (it is a preference, not prompt data). */
export const INFERENCE_MODE_SETTINGS = [
  'prefer-on-device',
  'only-on-device',
  'only-in-cloud',
] as const;

export type InferenceModeSetting = (typeof INFERENCE_MODE_SETTINGS)[number];

export const DEFAULT_INFERENCE_MODE: InferenceModeSetting = 'prefer-on-device';

export function isInferenceModeSetting(value: unknown): value is InferenceModeSetting {
  return (
    typeof value === 'string' &&
    (INFERENCE_MODE_SETTINGS as readonly string[]).includes(value)
  );
}

/** What actually ran, derived only from the SDK's `inferenceSource`. */
export type SourceLabel = 'on-device' | 'cloud' | 'unknown';

export type RunSource = SourceLabel | 'mixed';

/**
 * Combine per-attempt sources (retries can land on different backends). On-device is only
 * claimed when every attempt reported it.
 */
export function summarizeSources(labels: SourceLabel[]): RunSource {
  if (labels.length === 0) return 'unknown';
  if (labels.every((l) => l === 'on-device')) return 'on-device';
  if (labels.every((l) => l === 'cloud')) return 'cloud';
  if (labels.includes('unknown')) return 'unknown';
  return 'mixed';
}

export const MODE_LABELS: Record<InferenceModeSetting, string> = {
  'prefer-on-device': 'Prefer on-device (cloud fallback)',
  'only-on-device': 'On-device only (testing)',
  'only-in-cloud': 'Cloud only (testing)',
};

export const SOURCE_LABELS: Record<RunSource, string> = {
  'on-device': 'On-device',
  cloud: 'Cloud',
  mixed: 'Mixed (on-device and cloud across retries)',
  unknown: 'Unknown',
};

/** Metadata about one detection call. Never contains prompt text. */
export interface InferenceRunReport {
  requestedMode: InferenceModeSetting;
  source: RunSource;
  attemptSources: SourceLabel[];
  ok: boolean;
  /** Set when the call failed; a static code, never a message derived from prompt data. */
  errorCode?: string;
  /** True when on-device-only was requested but something other than on-device ran. */
  onDeviceViolation: boolean;
  finishedAt: number;
}

export function buildRunReport(args: {
  requestedMode: InferenceModeSetting;
  attemptSources: SourceLabel[];
  ok: boolean;
  errorCode?: string;
  now?: () => number;
}): InferenceRunReport {
  const source = summarizeSources(args.attemptSources);
  return {
    requestedMode: args.requestedMode,
    source,
    attemptSources: args.attemptSources,
    ok: args.ok,
    errorCode: args.errorCode,
    onDeviceViolation:
      args.requestedMode === 'only-on-device' &&
      args.attemptSources.length > 0 &&
      source !== 'on-device',
    finishedAt: (args.now ?? Date.now)(),
  };
}
