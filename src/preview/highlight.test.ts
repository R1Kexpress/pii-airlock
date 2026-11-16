import { describe, expect, it } from 'vitest';
import type { DetectionSpan } from '../detection/types';
import { buildHighlightedSegments } from './highlight';

const span = (
  partial: Pick<DetectionSpan, 'type' | 'start' | 'end'>,
): DetectionSpan => ({
  ...partial,
  confidence: 0.9,
  source: 'regex',
});

describe('buildHighlightedSegments', () => {
  it('returns plain text when no spans', () => {
    const parts = buildHighlightedSegments('hello', []);
    expect(parts).toEqual([{ kind: 'plain', text: 'hello' }]);
  });

  it('wraps detections with indices', () => {
    const text = 'my email is a@b.co ok';
    const parts = buildHighlightedSegments(text, [
      span({ type: 'email', start: 12, end: 18 }),
    ]);
    expect(parts.some((p) => p.kind === 'highlight' && p.text === 'a@b.co')).toBe(
      true,
    );
  });
});