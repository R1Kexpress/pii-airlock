import { describe, expect, it, vi } from 'vitest';
import type { ModelClient } from '../detection/model/detect';

vi.mock('../firebase/init', () => ({
  initFirebase: () => {
    const error = new Error('Missing Firebase build-time env vars: VITE_FIREBASE_API_KEY');
    error.name = 'FirebaseConfigError';
    throw error;
  },
}));

import { DetectWithModelError, detectWithModel } from './detect-with-model';

const TEXT = 'write to jane@example.com';
const GOOD = JSON.stringify({ findings: [{ type: 'email', text: 'jane@example.com' }] });

function client(...responses: Array<{ text: string; inferenceSource?: string }>): ModelClient {
  const queue = [...responses];
  return {
    generate: async () => {
      const next = queue.shift();
      if (!next) throw new Error('no more');
      return { text: next.text, inferenceSource: next.inferenceSource };
    },
  };
}

describe('detectWithModel', () => {
  it('returns spans and a run report showing on-device', async () => {
    const result = await detectWithModel(TEXT, 'prefer-on-device', {
      client: client({ text: GOOD, inferenceSource: 'on_device' }),
    });
    expect(result.spans).toHaveLength(1);
    expect(result.run).toMatchObject({
      requestedMode: 'prefer-on-device',
      source: 'on-device',
      ok: true,
      onDeviceViolation: false,
    });
  });

  it('reports cloud when the SDK says in_cloud', async () => {
    const result = await detectWithModel(TEXT, 'only-in-cloud', {
      client: client({ text: GOOD, inferenceSource: 'in_cloud' }),
    });
    expect(result.run.source).toBe('cloud');
  });

  it('does not claim on-device when a retry went to the cloud', async () => {
    const result = await detectWithModel(TEXT, 'prefer-on-device', {
      client: client(
        { text: 'garbage', inferenceSource: 'on_device' },
        { text: GOOD, inferenceSource: 'in_cloud' },
      ),
    });
    expect(result.run.source).toBe('mixed');
  });

  it('does not claim on-device when inferenceSource is missing', async () => {
    const result = await detectWithModel(TEXT, 'prefer-on-device', { client: client({ text: GOOD }) });
    expect(result.run.source).toBe('unknown');
  });

  it('flags only-on-device that ran in the cloud', async () => {
    const result = await detectWithModel(TEXT, 'only-on-device', {
      client: client({ text: GOOD, inferenceSource: 'in_cloud' }),
    });
    expect(result.run.onDeviceViolation).toBe(true);
  });

  it('keeps the run report on failure, with sources observed so far', async () => {
    const error = await detectWithModel(TEXT, 'prefer-on-device', {
      client: client(...Array.from({ length: 3 }, () => ({ text: 'bad', inferenceSource: 'on_device' }))),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DetectWithModelError);
    const failure = error as DetectWithModelError;
    expect(failure.run).toMatchObject({ ok: false, source: 'on-device' });
    expect(failure.message).not.toContain('jane@example.com');
  });

  it('reports missing Firebase config with a static code and no model attempt', async () => {
    const error = await detectWithModel(TEXT, 'prefer-on-device').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DetectWithModelError);
    expect((error as DetectWithModelError).code).toBe('firebase-config-missing');
    expect((error as DetectWithModelError).run.attemptSources).toEqual([]);
  });
});
