import { ensureOffscreenDocument } from './offscreen-manager';
import {
  INFERENCE_HOST_TARGET,
  InferenceMessageType,
  type DiagnosticsResponse,
  type HostDetectRequest,
  type HostDiagnosticsRequest,
  type ModelDetectResponse,
  isModelDetectRequest,
  isModelDiagnosticsRequest,
} from './messages';
import { getModeSetting, saveLastRun } from './settings';
import type { InferenceModeSetting } from './modes';

async function sendToHost<T>(message: HostDetectRequest | HostDiagnosticsRequest): Promise<T> {
  await ensureOffscreenDocument();
  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch {
    // The host page may still be registering its listener right after creation; retry once.
    await new Promise((resolve) => setTimeout(resolve, 150));
    return (await chrome.runtime.sendMessage(message)) as T;
  }
}

export async function requestModelDetection(
  text: string,
  mode?: InferenceModeSetting,
): Promise<ModelDetectResponse> {
  const resolvedMode = mode ?? (await getModeSetting());
  let response: ModelDetectResponse | undefined;
  try {
    response = await sendToHost<ModelDetectResponse | undefined>({
      target: INFERENCE_HOST_TARGET,
      type: InferenceMessageType.HOST_DETECT,
      text,
      mode: resolvedMode,
    });
  } catch {
    return { ok: false, errorCode: 'host-unreachable' };
  }
  if (!response || typeof response !== 'object' || typeof response.ok !== 'boolean') {
    return { ok: false, errorCode: 'host-bad-response' };
  }
  if (response.run) await saveLastRun(response.run);
  return response;
}

export async function requestDiagnostics(): Promise<DiagnosticsResponse> {
  try {
    const response = await sendToHost<DiagnosticsResponse | undefined>({
      target: INFERENCE_HOST_TARGET,
      type: InferenceMessageType.HOST_DIAGNOSTICS,
    });
    return response ?? { ok: false, errorCode: 'host-bad-response' };
  } catch {
    return { ok: false, errorCode: 'host-unreachable' };
  }
}

/** Service-worker side of the bridge. Accepts requests from extension pages only. */
export function registerInferenceBridge(): void {
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;

    if (isModelDetectRequest(message)) {
      void requestModelDetection(message.text, message.mode).then(sendResponse);
      return true;
    }
    if (isModelDiagnosticsRequest(message)) {
      void requestDiagnostics().then(sendResponse);
      return true;
    }
    return false;
  });
}
