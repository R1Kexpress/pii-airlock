import { PII_TYPES, type PiiType } from '../types';

export interface ModelFinding {
  type: PiiType;
  text: string;
}

export const MAX_FINDINGS = 200;
export const MAX_FINDING_TEXT_LENGTH = 512;

/** Messages are static on purpose: they must never echo model output or prompt text. */
export class ModelOutputError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid model output: ${reason}`);
    this.name = 'ModelOutputError';
  }
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1] : trimmed;
}

const PII_TYPE_SET: ReadonlySet<string> = new Set(PII_TYPES);

/** Strictly validates `{"findings":[{"type":..., "text":...}]}`; throws ModelOutputError otherwise. */
export function parseModelFindings(raw: string): ModelFinding[] {
  let data: unknown;
  try {
    data = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new ModelOutputError('not-json');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new ModelOutputError('not-an-object');
  }
  const findings = (data as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) throw new ModelOutputError('findings-not-array');
  if (findings.length > MAX_FINDINGS) throw new ModelOutputError('too-many-findings');

  return findings.map((item): ModelFinding => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ModelOutputError('finding-not-object');
    }
    const { type, text } = item as { type?: unknown; text?: unknown };
    if (typeof type !== 'string' || !PII_TYPE_SET.has(type)) {
      throw new ModelOutputError('finding-bad-type');
    }
    if (typeof text !== 'string') throw new ModelOutputError('finding-bad-text');
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_FINDING_TEXT_LENGTH) {
      throw new ModelOutputError('finding-bad-text-length');
    }
    return { type: type as PiiType, text: trimmed };
  });
}
