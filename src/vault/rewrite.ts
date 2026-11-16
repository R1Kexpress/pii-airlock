import { type DetectionSpan, spansOverlap } from '../detection/types';
import { findPlaceholderTokens } from './placeholder';
import { PlaceholderVault } from './vault';

export type KeepSpan = { start: number; end: number };

/** Positive when `a` should win over `b` for overlapping text. */
function beats(a: DetectionSpan, b: DetectionSpan): number {
  if (a.confidence !== b.confidence) {
    return a.confidence - b.confidence;
  }
  const lenA = a.end - a.start;
  const lenB = b.end - b.start;
  if (lenA !== lenB) {
    return lenA - lenB;
  }
  return b.type.localeCompare(a.type);
}

function isKept(span: DetectionSpan, keep: readonly KeepSpan[]): boolean {
  return keep.some((k) => k.start === span.start && k.end === span.end);
}

/**
 * Picks a maximal set of non-overlapping spans to rewrite; higher priority wins
 * when a candidate overlaps something already selected.
 */
export function selectSpansForRewrite(
  detections: readonly DetectionSpan[],
  keep: readonly KeepSpan[] = [],
): DetectionSpan[] {
  const candidates = detections.filter((d) => !isKept(d, keep));
  const sorted = [...candidates].sort((a, b) => beats(b, a));

  const selected: DetectionSpan[] = [];

  for (const candidate of sorted) {
    const overlapping = selected.filter((s) => spansOverlap(s, candidate));
    if (overlapping.length === 0) {
      selected.push(candidate);
      continue;
    }
    const weakest = overlapping.reduce((worst, s) => (beats(s, worst) > 0 ? s : worst));
    if (beats(candidate, weakest) > 0) {
      for (const s of overlapping) {
        if (beats(candidate, s) > 0) {
          const idx = selected.indexOf(s);
          if (idx >= 0) {
            selected.splice(idx, 1);
          }
        }
      }
      const stillOverlaps = selected.some((s) => spansOverlap(s, candidate));
      if (!stillOverlaps) {
        selected.push(candidate);
      }
    }
  }

  return selected.sort((a, b) => a.start - b.start);
}

export function rewritePrompt(
  text: string,
  detections: readonly DetectionSpan[],
  vault: PlaceholderVault,
  keep: readonly KeepSpan[] = [],
): string {
  if (text.length === 0) {
    return text;
  }

  const toReplace = selectSpansForRewrite(detections, keep);
  if (toReplace.length === 0) {
    return text;
  }

  const byStart = [...toReplace].sort((a, b) => a.start - b.start);
  for (const span of byStart) {
    vault.getOrCreate(span.type, text.slice(span.start, span.end));
  }

  const ordered = [...toReplace].sort((a, b) => b.start - a.start);
  let result = text;
  for (const span of ordered) {
    const raw = text.slice(span.start, span.end);
    const token = vault.getOrCreate(span.type, raw);
    result = result.slice(0, span.start) + token + result.slice(span.end);
  }
  return result;
}

export function restoreText(text: string, vault: PlaceholderVault): string {
  const tokens = [...new Set(findPlaceholderTokens(text))].sort(
    (a, b) => b.length - a.length,
  );
  let result = text;
  for (const token of tokens) {
    const value = vault.lookup(token);
    if (value === undefined) {
      continue;
    }
    result = result.split(token).join(value);
  }
  return result;
}