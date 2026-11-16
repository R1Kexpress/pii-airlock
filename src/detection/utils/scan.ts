import type { DetectionSpan, PiiType } from '../types';

export interface RegexMatchOptions {
  type: PiiType;
  pattern: RegExp;
  confidence: number;
  validate?: (match: string, text: string, start: number) => boolean;
}

export function scanRegex(
  text: string,
  options: RegexMatchOptions,
): DetectionSpan[] {
  const { type, pattern, confidence, validate } = options;
  const flags = pattern.flags.includes('g')
    ? pattern.flags
    : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const spans: DetectionSpan[] = [];

  for (const match of text.matchAll(re)) {
    const matched = match[0];
    if (!matched) continue;
    const start = match.index ?? 0;
    const end = start + matched.length;
    if (validate && !validate(matched, text, start)) continue;
    spans.push({
      type,
      start,
      end,
      confidence,
      source: 'regex',
    });
  }
  return spans;
}