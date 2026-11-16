import type { DetectionSpan } from '../detection/types';
import {
  ModelDetectionError,
  detectSpansWithClient,
  type DetectOptions,
  type ModelClient,
} from '../detection/model/detect';
import { initFirebase } from '../firebase/init';
import { createHybridClient } from './hybrid-model';
import { mapInferenceSource } from './firebase-mapping';
import {
  type InferenceModeSetting,
  type InferenceRunReport,
  buildRunReport,
} from './modes';

export interface DetectWithModelResult {
  /** Feed to `mergeDetections(regexSpans, result.spans)`. */
  spans: DetectionSpan[];
  run: InferenceRunReport;
}

/** Thrown on failure; `run` carries the (prompt-free) report so the UI can still show what ran. */
export class DetectWithModelError extends Error {
  constructor(
    readonly code: string,
    readonly run: InferenceRunReport,
  ) {
    super(`detectWithModel failed: ${code}`);
    this.name = 'DetectWithModelError';
  }
}

const clientCache = new Map<InferenceModeSetting, ModelClient>();

export function clearModelClientCache(): void {
  clientCache.clear();
}

export interface DetectWithModelDeps {
  client?: ModelClient;
  options?: DetectOptions;
}

/**
 * Asks the hybrid model for PII spans. Runs only in a context that can host the Prompt API
 * (offscreen document or extension page), never the service worker.
 */
export async function detectWithModel(
  text: string,
  mode: InferenceModeSetting = 'prefer-on-device',
  deps: DetectWithModelDeps = {},
): Promise<DetectWithModelResult> {
  let client = deps.client;
  if (!client) {
    try {
      client = clientCache.get(mode);
      if (!client) {
        const { ai, cloudModel } = initFirebase();
        client = createHybridClient({ ai, cloudModel, setting: mode });
        clientCache.set(mode, client);
      }
    } catch (error) {
      const code = error instanceof Error && error.name === 'FirebaseConfigError'
        ? 'firebase-config-missing'
        : 'firebase-init-failed';
      throw new DetectWithModelError(
        code,
        buildRunReport({ requestedMode: mode, attemptSources: [], ok: false, errorCode: code }),
      );
    }
  }

  try {
    const outcome = await detectSpansWithClient(text, client, deps.options);
    return {
      spans: outcome.spans,
      run: buildRunReport({
        requestedMode: mode,
        attemptSources: outcome.attemptSources.map(mapInferenceSource),
        ok: true,
      }),
    };
  } catch (error) {
    if (error instanceof ModelDetectionError) {
      throw new DetectWithModelError(
        error.code,
        buildRunReport({
          requestedMode: mode,
          attemptSources: error.attemptSources.map(mapInferenceSource),
          ok: false,
          errorCode: error.code,
        }),
      );
    }
    throw new DetectWithModelError(
      'internal-error',
      buildRunReport({ requestedMode: mode, attemptSources: [], ok: false, errorCode: 'internal-error' }),
    );
  }
}
