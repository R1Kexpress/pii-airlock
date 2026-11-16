import { describe, expect, it, vi } from 'vitest';
import { mergeDetections } from '../merge';
import type { DetectionSpan } from '../types';
import {
  DEFAULT_MAX_ATTEMPTS,
  ModelDetectionError,
  detectSpansWithClient,
  type ModelClient,
  type ModelResponse,
} from './detect';

const TEXT = 'Reach me at jane@example.com please';
const GOOD = JSON.stringify({ findings: [{ type: 'email', text: 'jane@example.com' }] });

function clientFrom(responses: Array<ModelResponse | Error>): ModelClient & {
  generate: ReturnType<typeof vi.fn>;
} {
  const queue = [...responses];
  const generate = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected extra call');
    if (next instanceof Error) throw next;
    return next;
  });
  return { generate };
}

describe('detectSpansWithClient', () => {
  it('returns DetectionSpan-compatible results usable by mergeDetections', async () => {
    const client = clientFrom([{ text: GOOD, inferenceSource: 'on_device' }]);
    const outcome = await detectSpansWithClient(TEXT, client);

    expect(outcome.attempts).toBe(1);
    expect(outcome.attemptSources).toEqual(['on_device']);
    expect(outcome.spans).toEqual([
      { type: 'email', start: 12, end: 28, confidence: 0.75, source: 'model' },
    ]);

    const regex: DetectionSpan[] = [
      { type: 'email', start: 12, end: 28, confidence: 0.86, source: 'regex' },
    ];
    expect(mergeDetections(regex, outcome.spans)).toHaveLength(1);
  });

  it('retries invalid output and succeeds on a later attempt', async () => {
    const client = clientFrom([
      { text: 'not json', inferenceSource: 'on_device' },
      { text: GOOD, inferenceSource: 'in_cloud' },
    ]);
    const outcome = await detectSpansWithClient(TEXT, client);
    expect(outcome.attempts).toBe(2);
    expect(outcome.attemptSources).toEqual(['on_device', 'in_cloud']);
    expect(client.generate.mock.calls[1][0]).toContain('previous reply was not valid');
    expect(client.generate.mock.calls[0][0]).not.toContain('previous reply was not valid');
  });

  it('is bounded: gives up after maxAttempts with a static error', async () => {
    const client = clientFrom(
      Array.from({ length: DEFAULT_MAX_ATTEMPTS }, () => ({
        text: 'nope',
        inferenceSource: 'in_cloud',
      })),
    );
    const error = await detectSpansWithClient(TEXT, client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelDetectionError);
    expect((error as ModelDetectionError).code).toBe('invalid-output:not-json');
    expect((error as ModelDetectionError).attemptSources).toEqual(['in_cloud', 'in_cloud', 'in_cloud']);
    expect(client.generate).toHaveBeenCalledTimes(DEFAULT_MAX_ATTEMPTS);
  });

  it('clamps maxAttempts', async () => {
    const many = Array.from({ length: 20 }, () => ({ text: 'x', inferenceSource: 'in_cloud' }));
    const client = clientFrom(many);
    await expect(detectSpansWithClient(TEXT, client, { maxAttempts: 100 })).rejects.toBeInstanceOf(
      ModelDetectionError,
    );
    expect(client.generate).toHaveBeenCalledTimes(5);

    const single = clientFrom([{ text: 'x', inferenceSource: 'in_cloud' }]);
    await expect(detectSpansWithClient(TEXT, single, { maxAttempts: 0 })).rejects.toBeInstanceOf(
      ModelDetectionError,
    );
    expect(single.generate).toHaveBeenCalledTimes(1);
  });

  it('does not retry client failures and never leaks the error message', async () => {
    const failure = Object.assign(new Error(`boom with ${TEXT}`), { code: 'AI/no-model' });
    const client = clientFrom([failure]);
    const error = await detectSpansWithClient(TEXT, client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelDetectionError);
    expect((error as ModelDetectionError).code).toBe('AI/no-model');
    expect((error as Error).message).not.toContain('jane@example.com');
    expect(client.generate).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic code for odd error codes', async () => {
    const failure = Object.assign(new Error('x'), { code: 'contains jane@example.com spaces' });
    const error = await detectSpansWithClient(TEXT, clientFrom([failure])).catch((e: unknown) => e);
    expect((error as ModelDetectionError).code).toBe('model-call-failed');
  });

  it('skips the model for blank input', async () => {
    const client = clientFrom([]);
    const outcome = await detectSpansWithClient('   ', client);
    expect(outcome.spans).toEqual([]);
    expect(client.generate).not.toHaveBeenCalled();
  });

  it('drops hallucinated findings but keeps located ones', async () => {
    const raw = JSON.stringify({
      findings: [
        { type: 'email', text: 'jane@example.com' },
        { type: 'ssn', text: '000-00-0000' },
      ],
    });
    const outcome = await detectSpansWithClient(TEXT, clientFrom([{ text: raw, inferenceSource: 'on_device' }]));
    expect(outcome.spans).toHaveLength(1);
    expect(outcome.droppedFindings).toBe(1);
  });
});
