/** Extension message protocol (no prompt text in payloads — detection uses indices only when wired). */

export const MessageType = {
  PING: 'PING',
  PONG: 'PONG',
  DETECT_PII: 'DETECT_PII',
  DETECT_PII_RESULT: 'DETECT_PII_RESULT',
} as const;

export type MessageTypeName = (typeof MessageType)[keyof typeof MessageType];

export interface PingMessage {
  type: typeof MessageType.PING;
}

export interface PongMessage {
  type: typeof MessageType.PONG;
  from: 'service-worker' | 'content-script' | 'popup';
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

export type ExtensionMessage =
  | PingMessage
  | PongMessage
  | DetectPiiMessage
  | DetectPiiResultMessage;

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  const t = (value as { type: string }).type;
  return Object.values(MessageType).includes(t as MessageTypeName);
}