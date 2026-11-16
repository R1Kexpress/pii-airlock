/** Extension message protocol (no prompt text in payloads — detection uses indices only when wired). */

import type { InferenceMode } from '../inference/mode';
import type { AirlockSettings, PresetId } from '../settings/types';
import type { SessionLedger } from '../session/ledger';

export const MessageType = {
  PING: 'PING',
  PONG: 'PONG',
  DETECT_PII: 'DETECT_PII',
  DETECT_PII_RESULT: 'DETECT_PII_RESULT',
  GET_POPUP_STATE: 'GET_POPUP_STATE',
  POPUP_STATE: 'POPUP_STATE',
  SET_ENABLED: 'SET_ENABLED',
  GET_SETTINGS: 'GET_SETTINGS',
  SETTINGS: 'SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  SAVE_SETTINGS_RESULT: 'SAVE_SETTINGS_RESULT',
  SET_INFERENCE_MODE: 'SET_INFERENCE_MODE',
  RECORD_LEDGER: 'RECORD_LEDGER',
} as const;

export type MessageTypeName = (typeof MessageType)[keyof typeof MessageType];

export interface PingMessage {
  type: typeof MessageType.PING;
}

export interface PongMessage {
  type: typeof MessageType.PONG;
  from: 'service-worker' | 'content-script' | 'popup' | 'options';
}

export interface DetectPiiMessage {
  type: typeof MessageType.DETECT_PII;
  /** Length of text only — raw text must not be logged or persisted by the extension core. */
  textLength: number;
}

export interface DetectPiiResultMessage {
  type: typeof MessageType.DETECT_PII_RESULT;
  spanCount: number;
  ok: boolean;
}

export interface GetPopupStateMessage {
  type: typeof MessageType.GET_POPUP_STATE;
}

export interface PopupStateMessage {
  type: typeof MessageType.POPUP_STATE;
  connected: boolean;
  enabled: boolean;
  inferenceMode: InferenceMode;
  ledger: SessionLedger;
  activePreset: PresetId;
}

export interface SetEnabledMessage {
  type: typeof MessageType.SET_ENABLED;
  enabled: boolean;
}

export interface GetSettingsMessage {
  type: typeof MessageType.GET_SETTINGS;
}

export interface SettingsMessage {
  type: typeof MessageType.SETTINGS;
  settings: AirlockSettings;
}

export interface SaveSettingsMessage {
  type: typeof MessageType.SAVE_SETTINGS;
  settings: AirlockSettings;
}

export interface SaveSettingsResultMessage {
  type: typeof MessageType.SAVE_SETTINGS_RESULT;
  ok: boolean;
}

export interface SetInferenceModeMessage {
  type: typeof MessageType.SET_INFERENCE_MODE;
  mode: InferenceMode;
}

export interface RecordLedgerMessage {
  type: typeof MessageType.RECORD_LEDGER;
  /** Count increments only — never prompt text. */
  increments: Partial<SessionLedger>;
}

export type ExtensionMessage =
  | PingMessage
  | PongMessage
  | DetectPiiMessage
  | DetectPiiResultMessage
  | GetPopupStateMessage
  | PopupStateMessage
  | SetEnabledMessage
  | GetSettingsMessage
  | SettingsMessage
  | SaveSettingsMessage
  | SaveSettingsResultMessage
  | SetInferenceModeMessage
  | RecordLedgerMessage;

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  const t = (value as { type: string }).type;
  return Object.values(MessageType).includes(t as MessageTypeName);
}