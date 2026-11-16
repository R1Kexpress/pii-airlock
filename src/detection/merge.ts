import { type DetectionSpan, type DetectionSource, spansOverlap } from './types';

function spanKey(s: DetectionSpan): string {
  return `${s.type}:${s.start}:${s.end}:${s.source}`;
}

function comparePriority(a: DetectionSpan, b: DetectionSpan): DetectionSpan {
  if (a.confidence !== b.confidence) {
    return a.confidence > b.confidence ? a : b;
  }
  const rank = (source: DetectionSource) => (source === 'model' ? 1 : 0);
  if (rank(a.source) !== rank(b.source)) {
    return rank(a.source) > rank(b.source) ? a : b;
  }
  const lenA = a.end - a.start;
  const lenB = b.end - b.start;
  return lenA >= lenB ? a : b;
}

function dedupeExact(spans: DetectionSpan[]): DetectionSpan[] {
  const seen = new Map<string, DetectionSpan>();
  for (const s of spans) {
    const key = `${s.type}:${s.start}:${s.end}`;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, s);
      continue;
    }
    seen.set(key, comparePriority(s, prev));
  }
  return [...seen.values()];
}

function resolveSameTypeOverlap(
  kept: DetectionSpan[],
  candidate: DetectionSpan,
): DetectionSpan[] {
  const next: DetectionSpan[] = [];
  let consumed = false;

  for (const existing of kept) {
    if (existing.type !== candidate.type || !spansOverlap(existing, candidate)) {
      next.push(existing);
      continue;
    }
    const winner = comparePriority(existing, candidate);
    if (winner === candidate) {
      consumed = true;
      continue;
    }
    consumed = true;
    next.push(existing);
  }

  if (!consumed) {
    next.push(candidate);
  } else {
    const stillOverlaps = next.some(
      (s) => s.type === candidate.type && spansOverlap(s, candidate),
    );
    if (!stillOverlaps) {
      next.push(candidate);
    } else {
      const winnerAmong = [
        candidate,
        ...next.filter(
          (s) => s.type === candidate.type && spansOverlap(s, candidate),
        ),
      ].reduce(comparePriority);
      return [
        ...next.filter(
          (s) =>
            s.type !== candidate.type || !spansOverlap(s, winnerAmong),
        ),
        winnerAmong,
      ].sort((a, b) => a.start - b.start || a.end - b.end);
    }
  }

  return next.sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Combine regex and on-device model spans with overlap resolution.
 * Different PII types may overlap in text; both are kept. Same-type overlaps pick one winner.
 */
export function mergeDetections(
  regexSpans: DetectionSpan[],
  modelSpans: DetectionSpan[] = [],
): DetectionSpan[] {
  const combined = dedupeExact([...regexSpans, ...modelSpans]);
  combined.sort((a, b) => a.start - b.start || b.end - a.end);

  let result: DetectionSpan[] = [];

  for (const candidate of combined) {
    const sameTypeOverlap = result.some(
      (s) => s.type === candidate.type && spansOverlap(s, candidate),
    );

    if (!sameTypeOverlap) {
      const crossTypeOnly = result.some(
        (s) => s.type !== candidate.type && spansOverlap(s, candidate),
      );
      if (crossTypeOnly) {
        const seen = new Set(result.map(spanKey));
        if (!seen.has(spanKey(candidate))) {
          result.push(candidate);
        }
      } else {
        result.push(candidate);
      }
      result.sort((a, b) => a.start - b.start || a.end - b.end);
      continue;
    }

    result = resolveSameTypeOverlap(result, candidate);
  }

  return result;
}