import type { DetectionSpan } from '../detection/types';

export type TextSegmentKind = 'plain' | 'highlight';

export interface TextSegment {
  kind: TextSegmentKind;
  text: string;
  spanIndex?: number;
}

/** Build renderable segments from text and detection spans (sorted, non-overlapping display). */
export function buildHighlightedSegments(
  text: string,
  spans: DetectionSpan[],
): TextSegment[] {
  if (!text) return [];
  if (spans.length === 0) return [{ kind: 'plain', text }];

  const sorted = [...spans]
    .map((span, spanIndex) => ({ span, spanIndex }))
    .sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const { span, spanIndex } of sorted) {
    const start = Math.max(0, Math.min(span.start, text.length));
    const end = Math.max(start, Math.min(span.end, text.length));
    if (end <= cursor) continue;
    if (start > cursor) {
      segments.push({ kind: 'plain', text: text.slice(cursor, start) });
    }
    if (end > start) {
      segments.push({
        kind: 'highlight',
        text: text.slice(start, end),
        spanIndex,
      });
    }
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'plain', text: text.slice(cursor) });
  }

  return segments;
}