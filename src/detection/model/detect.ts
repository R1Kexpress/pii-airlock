import type { DetectionSpan } from '../types';
import { buildUserPrompt } from './prompt';
import { locateFindings } from './locate';
import { ModelOutputError, parseModelFindings } from './parse';

export interface ModelResponse {
  text: string;
  /** Raw `inferenceSource` from the SDK response (undefined if absent). */
  inferenceSource: string | undefined;
}

/** Sends one prompt to the (already configured) hybrid model. */
export interface ModelClient {
  generate(prompt: string): Promise<ModelResponse>;
}

export const DEFAULT_MODEL_CONFIDENCE = 0.75;
export const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_ATTEMPTS_CAP = 5;

export interface DetectOptions {
  /** Total attempts including the first (retries happen only for invalid output). */
  maxAttempts?: number;
  confidence?: number;
}

export interface DetectOutcome {
  spans: DetectionSpan[];
  attempts: number;
  /** Raw `inferenceSource` of each attempt, in order. */
  attemptSources: Array<string | undefined>;
  droppedFindings: number;
}

/** Carries only static metadata. `cause` is intentionally not attached. */
export class ModelDetectionError extends Error {
  constructor(
    readonly code: string,
    readonly attemptSources: Array<string | undefined>,
  ) {
    super(`Model detection failed: ${code}`);
    this.name = 'ModelDetectionError';
  }
}

function errorCodeOf(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && /^[\w:/.-]{1,64}$/.test(code)) return code;
  }
  return 'model-call-failed';
}

export async function detectSpansWithClient(
  text: string,
  client: ModelClient,
  options: DetectOptions = {},
): Promise<DetectOutcome> {
  const maxAttempts = Math.min(
    Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)),
    MAX_ATTEMPTS_CAP,
  );
  const confidence = options.confidence ?? DEFAULT_MODEL_CONFIDENCE;
  const attemptSources: Array<string | undefined> = [];

  if (text.trim().length === 0) {
    return { spans: [], attempts: 0, attemptSources, droppedFindings: 0 };
  }

  let lastReason = 'invalid-output';
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: ModelResponse;
    try {
      response = await client.generate(buildUserPrompt(text, attempt));
    } catch (error) {
      // A failed call may still have gone to the network; record nothing about it as on-device.
      throw new ModelDetectionError(errorCodeOf(error), attemptSources);
    }
    attemptSources.push(response.inferenceSource);

    try {
      const findings = parseModelFindings(response.text);
      const { spans, droppedFindings } = locateFindings(text, findings, confidence);
      return { spans, attempts: attempt + 1, attemptSources, droppedFindings };
    } catch (error) {
      if (!(error instanceof ModelOutputError)) {
        throw new ModelDetectionError('internal-error', attemptSources);
      }
      lastReason = error.reason;
    }
  }

  throw new ModelDetectionError(`invalid-output:${lastReason}`, attemptSources);
}
