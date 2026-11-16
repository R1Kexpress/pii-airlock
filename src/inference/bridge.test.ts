import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INFERENCE_HOST_TARGET, InferenceMessageType, type ModelDetectResponse } from './messages';
import type { InferenceRunReport } from './modes';

const run: InferenceRunReport = {
  requestedMode: 'prefer-on-device',
  source: 'on-device',
  attemptSources: ['on-device'],
  ok: true,
  onDeviceViolation: false,
  finishedAt: 1,
};

const sendMessage = vi.fn();
const createDocument = vi.fn(async () => undefined);
const hasDocument = vi.fn(async () => false);
const sessionSet = vi.fn(async () => undefined);
let listener: (m: unknown, s: { id?: string; tab?: unknown }, r: (x: unknown) => void) => boolean | undefined;

beforeEach(() => {
  sendMessage.mockReset();
  createDocument.mockClear();
  hasDocument.mockReset().mockResolvedValue(false);
  sessionSet.mockClear();
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'ext',
      sendMessage,
      onMessage: { addListener: (fn: typeof listener) => (listener = fn) },
    },
    offscreen: { hasDocument, createDocument, Reason: { TESTING: 'TESTING' } },
    storage: {
      local: { get: async () => ({ inferenceMode: 'only-in-cloud' }) },
      session: { set: sessionSet },
    },
  });
});

async function load() {
  vi.resetModules();
  return import('./bridge');
}

describe('inference bridge', () => {
  it('creates the offscreen document, forwards stored mode, and saves the run report only', async () => {
    sendMessage.mockResolvedValue({ ok: true, spans: [], run } satisfies ModelDetectResponse);
    const { registerInferenceBridge } = await load();
    registerInferenceBridge();

    const respond = vi.fn();
    expect(
      listener({ type: InferenceMessageType.MODEL_DETECT, text: 'hello' }, { id: 'ext' }, respond),
    ).toBe(true);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());

    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'src/inference/offscreen.html', reasons: ['TESTING'] }),
    );
    expect(sendMessage).toHaveBeenCalledWith({
      target: INFERENCE_HOST_TARGET,
      type: InferenceMessageType.HOST_DETECT,
      text: 'hello',
      mode: 'only-in-cloud',
    });
    expect(sessionSet).toHaveBeenCalledWith({ lastInferenceRun: run });
    expect(JSON.stringify(sessionSet.mock.calls)).not.toContain('hello');
  });

  it('prefers an explicit mode override over the stored setting', async () => {
    sendMessage.mockResolvedValue({ ok: true, spans: [], run });
    const { registerInferenceBridge } = await load();
    registerInferenceBridge();
    const respond = vi.fn();
    listener({ type: InferenceMessageType.MODEL_DETECT, text: 't', mode: 'only-on-device' }, { id: 'ext' }, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(sendMessage.mock.calls[0][0].mode).toBe('only-on-device');
  });

  it('skips creating the document when one exists', async () => {
    hasDocument.mockResolvedValue(true);
    sendMessage.mockResolvedValue({ ok: true, spans: [], run });
    const { registerInferenceBridge } = await load();
    registerInferenceBridge();
    const respond = vi.fn();
    listener({ type: InferenceMessageType.MODEL_DETECT, text: 't' }, { id: 'ext' }, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('reports host-unreachable with a static code when messaging fails', async () => {
    sendMessage.mockRejectedValue(new Error('Could not establish connection with text t'));
    const { registerInferenceBridge } = await load();
    registerInferenceBridge();
    const respond = vi.fn();
    listener({ type: InferenceMessageType.MODEL_DETECT, text: 't' }, { id: 'ext' }, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled());
    expect(respond).toHaveBeenCalledWith({ ok: false, errorCode: 'host-unreachable' });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('ignores other extensions and unrelated messages', async () => {
    const { registerInferenceBridge } = await load();
    registerInferenceBridge();
    const respond = vi.fn();
    expect(listener({ type: InferenceMessageType.MODEL_DETECT, text: 't' }, { id: 'other' }, respond)).toBe(false);
    expect(listener({ type: 'PING' }, { id: 'ext' }, respond)).toBe(false);
    expect(listener({ type: InferenceMessageType.MODEL_DETECT, text: 5 }, { id: 'ext' }, respond)).toBe(false);
    expect(respond).not.toHaveBeenCalled();
  });
});
