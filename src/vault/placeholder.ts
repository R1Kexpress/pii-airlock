import type { PiiType } from '../detection/types';

/** Placeholder token shape, e.g. `[EMAIL_1]`, `[CREDIT_CARD_2]`. */
const PLACEHOLDER_PATTERN = /^\[([A-Z][A-Z0-9_]*_\d+)\]$/;

export function piiTypeToPlaceholderLabel(type: PiiType): string {
  return type.toUpperCase();
}

export function parsePlaceholderToken(token: string): string | null {
  const m = PLACEHOLDER_PATTERN.exec(token);
  return m ? m[1] : null;
}

export function isPlaceholderToken(token: string): boolean {
  return PLACEHOLDER_PATTERN.test(token);
}

/** Finds every `[TYPE_N]` token in `text` (non-nested, whole tokens only). */
export function findPlaceholderTokens(text: string): string[] {
  const re = /\[[A-Z][A-Z0-9_]*_\d+\]/g;
  return text.match(re) ?? [];
}