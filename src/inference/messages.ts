import type { DetectionSpan } from '../detection/types';
import type { OnDeviceStatus } from './hybrid-model';
import { type InferenceModeSetting, type InferenceRunReport, isInferenceModeSetting } from './modes';
import type { AppCheckStatus } from '../firebase/app-check';

/**
 * Message protocol between callers (popup, diagnostics, service worker) and the inference host.
 *
 * Request payloads carry prompt text because the host needs it; responses and stored reports
 * never do. Nothing here may be logged.
 */
export const INFERENCE_HOST_TARGET = 'inference-host' as const;

export const InferenceMessageType = {
  /** Page/popup -> service worker: run model detection (worker ensures the host exists). */
  MODEL_DETECT: 'AIRLOCK_MODEL_DETECT',
  /** Page/popup -> service worker: ask the host for diagnostics. */
  MODEL_DIAGNOSTICS: 'AIRLOCK_MODEL_DIAGNOSTICS',
  /** Service worker -> host. */
  HOST_DETECT: 'AIRLOCK_HOST_DETECT',
  HOST_DIAGNOSTICS: 'AIRLOCK_HOST_DIAGNOSTICS',
} as const;

export interface ModelDetectRequest {
  type: typeof InferenceMessageType.MODEL_DETECT;
  text: string;
  /** Test override; when absent the worker uses the stored mode preference. */
  mode?: InferenceModeSetting;
}

export interface ModelDiagnosticsRequest {
  type: typeof InferenceMessageType.MODEL_DIAGNOSTICS;
}

export interface HostDetectRequest {
  target: typeof INFERENCE_HOST_TARGET;
  type: typeof InferenceMessageType.HOST_DETECT;
  text: string;
  mode: InferenceModeSetting;
}

export interface HostDiagnosticsRequest {
  target: typeof INFERENCE_HOST_TARGET;
  type: typeof InferenceMessageType.HOST_DIAGNOSTICS;
}

export type ModelDetectResponse =
  | { ok: true; spans: DetectionSpan[]; run: InferenceRunReport }
  | { ok: false; errorCode: string; run?: InferenceRunReport };

export interface HostDiagnostics extends OnDeviceStatus {
  appCheck: AppCheckStatus | 'init-failed';
  context: 'offscreen-document' | 'extension-page';
}

export type DiagnosticsResponse =
  | { ok: true; diagnostics: HostDiagnostics }
  | { ok: false; errorCode: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isModelDetectRequest(value: unknown): value is ModelDetectRequest {
  return (
    isRecord(value) &&
    value.type === InferenceMessageType.MODEL_DETECT &&
    typeof value.text === 'string' &&
    (value.mode === undefined || isInferenceModeSetting(value.mode))
  );
}

export function isModelDiagnosticsRequest(value: unknown): value is ModelDiagnosticsRequest {
  return isRecord(value) && value.type === InferenceMessageType.MODEL_DIAGNOSTICS;
}

export function isHostDetectRequest(value: unknown): value is HostDetectRequest {
  return (
    isRecord(value) &&
    value.target === INFERENCE_HOST_TARGET &&
    value.type === InferenceMessageType.HOST_DETECT &&
    typeof value.text === 'string' &&
    isInferenceModeSetting(value.mode)
  );
}

export function isHostDiagnosticsRequest(value: unknown): value is HostDiagnosticsRequest {
  return (
    isRecord(value) &&
    value.target === INFERENCE_HOST_TARGET &&
    value.type === InferenceMessageType.HOST_DIAGNOSTICS
  );
}
