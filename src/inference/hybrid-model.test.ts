import type { AI, GenerativeModel, HybridParams } from 'firebase/ai';
import { describe, expect, it, vi } from 'vitest';
import { MODEL_SYSTEM_PROMPT } from '../detection/model/prompt';
import {
  OnDeviceUnavailableError,
  assertOnDeviceReady,
  buildHybridParams,
  createHybridClient,
} from './hybrid-model';
import { ON_DEVICE_RESPONSE_CONSTRAINT } from './schema';

vi.mock('firebase/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/ai')>();
  return { ...actual, getGenerativeModel: vi.fn() };
});

const fakeAi = {} as AI;

function fakeModel(inferenceSource: string | undefined, text = '{"findings":[]}') {
  const generateContent = vi.fn(async () => ({
    response: { text: () => text, inferenceSource },
  }));
  return { model: { generateContent } as unknown as GenerativeModel, generateContent };
}

describe('buildHybridParams', () => {
  it('configures both on-device and in-cloud sides', () => {
    const params = buildHybridParams('prefer-on-device', 'cloud-model');
    expect(params.mode).toBe('prefer_on_device');
    expect(params.onDeviceParams?.promptOptions?.responseConstraint).toBe(ON_DEVICE_RESPONSE_CONSTRAINT);
    expect(params.onDeviceParams?.createOptions?.initialPrompts?.[0]).toEqual({
      role: 'system',
      content: [{ type: 'text', value: MODEL_SYSTEM_PROMPT }],
    });
    expect(params.inCloudParams?.model).toBe('cloud-model');
    expect(params.inCloudParams?.systemInstruction).toBe(MODEL_SYSTEM_PROMPT);
    expect(params.inCloudParams?.generationConfig?.responseMimeType).toBe('application/json');
    expect(params.inCloudParams?.generationConfig?.responseSchema).toBeDefined();
  });

  it('forwards each mode', () => {
    expect(buildHybridParams('only-on-device', 'm').mode).toBe('only_on_device');
    expect(buildHybridParams('only-in-cloud', 'm').mode).toBe('only_in_cloud');
  });
});

describe('createHybridClient', () => {
  it('returns text and the raw inferenceSource from the response', async () => {
    const { model, generateContent } = fakeModel('on_device', '{"findings":[]}');
    const createModel = vi.fn((_ai: AI, _params: HybridParams) => model);
    const client = createHybridClient({ ai: fakeAi, cloudModel: 'm', setting: 'prefer-on-device', createModel });

    await expect(client.generate('p1')).resolves.toEqual({
      text: '{"findings":[]}',
      inferenceSource: 'on_device',
    });
    await client.generate('p2');
    expect(createModel).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(createModel.mock.calls[0][1].mode).toBe('prefer_on_device');
  });

  it('surfaces a missing inferenceSource as undefined (never assumed on-device)', async () => {
    const { model } = fakeModel(undefined);
    const client = createHybridClient({
      ai: fakeAi,
      cloudModel: 'm',
      setting: 'only-in-cloud',
      createModel: () => model,
    });
    expect((await client.generate('p')).inferenceSource).toBeUndefined();
  });

  it('only-on-device refuses to call the model when on-device is not ready', async () => {
    const { model, generateContent } = fakeModel('in_cloud');
    const createModel = vi.fn(() => model);
    const client = createHybridClient({
      ai: fakeAi,
      cloudModel: 'm',
      setting: 'only-on-device',
      createModel,
      checkOnDevice: async () => ({ hasLanguageModel: false, availability: 'missing' }),
    });
    await expect(client.generate('secret prompt')).rejects.toMatchObject({
      code: 'on-device-unavailable:language-model-missing',
    });
    expect(createModel).not.toHaveBeenCalled();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('only-on-device calls the model when availability is "available"', async () => {
    const { model, generateContent } = fakeModel('on_device');
    const client = createHybridClient({
      ai: fakeAi,
      cloudModel: 'm',
      setting: 'only-on-device',
      createModel: () => model,
      checkOnDevice: async () => ({ hasLanguageModel: true, availability: 'available' }),
    });
    await client.generate('p');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('prefer-on-device does not pre-check (cloud fallback is by design)', async () => {
    const { model, generateContent } = fakeModel('in_cloud');
    const checkOnDevice = vi.fn(async () => ({ hasLanguageModel: false, availability: 'missing' }));
    const client = createHybridClient({
      ai: fakeAi,
      cloudModel: 'm',
      setting: 'prefer-on-device',
      createModel: () => model,
      checkOnDevice,
    });
    await client.generate('p');
    expect(checkOnDevice).not.toHaveBeenCalled();
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe('assertOnDeviceReady', () => {
  it.each(['downloadable', 'downloading', 'unavailable', 'error'])('rejects availability %s', async (availability) => {
    await expect(
      assertOnDeviceReady(async () => ({ hasLanguageModel: true, availability })),
    ).rejects.toBeInstanceOf(OnDeviceUnavailableError);
  });
});
