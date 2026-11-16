import { scanRegex } from '../utils/scan';

const API_KEY_PATTERNS: Array<{ pattern: RegExp; confidence: number }> = [
  { pattern: /\bsk-[A-Za-z0-9]{20,}\b/g, confidence: 0.9 },
  { pattern: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g, confidence: 0.92 },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, confidence: 0.93 },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, confidence: 0.91 },
  { pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, confidence: 0.9 },
  { pattern: /\bghp_[A-Za-z0-9]{36,}\b/g, confidence: 0.92 },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, confidence: 0.92 },
];

export function detectApiKey(text: string) {
  return API_KEY_PATTERNS.flatMap(({ pattern, confidence }) =>
    scanRegex(text, { type: 'api_key', pattern, confidence }),
  );
}