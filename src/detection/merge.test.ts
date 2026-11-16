import { describe, expect, it } from 'vitest';
import type { DetectionSpan } from './types';
import { mergeDetections } from './merge';

function span(
  partial: Omit<DetectionSpan, 'confidence'> & { confidence?: number },
): DetectionSpan {
  return {
    confidence: partial.confidence ?? 0.8,
    ...partial,
  };
}

describe('mergeDetections', () => {
  it('returns empty when both inputs are empty', () => {
    expect(mergeDetections([], [])).toEqual([]);
  });

  it('passes through non-overlapping spans sorted by start', () => {
    const regex = [
      span({ type: 'email', start: 0, end: 10, source: 'regex' }),
      span({ type: 'phone', start: 20, end: 30, source: 'regex' }),
    ];
    const merged = mergeDetections(regex, []);
    expect(merged).toHaveLength(2);
    expect(merged[0].type).toBe('email');
    expect(merged[1].type).toBe('phone');
  });

  it('dedupes identical spans from regex and model', () => {
    const regex = [
      span({ type: 'ssn', start: 5, end: 16, source: 'regex', confidence: 0.85 }),
    ];
    const model = [
      span({ type: 'ssn', start: 5, end: 16, source: 'model', confidence: 0.9 }),
    ];
    const merged = mergeDetections(regex, model);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('model');
    expect(merged[0].confidence).toBe(0.9);
  });

  it('keeps higher-confidence span when overlaps share one boundary', () => {
    const regex = [
      span({ type: 'email', start: 0, end: 12, source: 'regex', confidence: 0.75 }),
    ];
    const model = [
      span({ type: 'email', start: 0, end: 12, source: 'model', confidence: 0.95 }),
    ];
    const merged = mergeDetections(regex, model);
    expect(merged).toEqual([
      span({ type: 'email', start: 0, end: 12, source: 'model', confidence: 0.95 }),
    ]);
  });

  it('prefers model over regex at equal confidence on overlap', () => {
    const regex = [
      span({ type: 'api_key', start: 2, end: 20, source: 'regex', confidence: 0.8 }),
    ];
    const model = [
      span({ type: 'api_key', start: 2, end: 20, source: 'model', confidence: 0.8 }),
    ];
    const merged = mergeDetections(regex, model);
    expect(merged[0].source).toBe('model');
  });

  it('drops lower-confidence span when fully overlapped', () => {
    const wide = span({
      type: 'credit_card',
      start: 0,
      end: 20,
      source: 'model',
      confidence: 0.9,
    });
    const narrow = span({
      type: 'credit_card',
      start: 5,
      end: 15,
      source: 'regex',
      confidence: 0.7,
    });
    const merged = mergeDetections([narrow], [wide]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ start: 0, end: 20, source: 'model' });
  });

  it('keeps both spans when overlap is partial and types differ (no forced merge)', () => {
    const a = span({ type: 'email', start: 0, end: 15, source: 'regex', confidence: 0.9 });
    const b = span({ type: 'phone', start: 10, end: 25, source: 'regex', confidence: 0.9 });
    const merged = mergeDetections([a, b], []);
    expect(merged).toHaveLength(2);
    expect(merged.map((s) => s.type).sort()).toEqual(['email', 'phone']);
  });

  it('resolves partial overlap for same type by keeping higher confidence span only', () => {
    const low = span({
      type: 'iban',
      start: 0,
      end: 18,
      source: 'regex',
      confidence: 0.6,
    });
    const high = span({
      type: 'iban',
      start: 10,
      end: 34,
      source: 'model',
      confidence: 0.92,
    });
    const merged = mergeDetections([low], [high]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('model');
    expect(merged[0].start).toBe(10);
    expect(merged[0].end).toBe(34);
  });

  it('does not merge adjacent non-overlapping spans of same type', () => {
    const a = span({ type: 'email', start: 0, end: 5, source: 'regex' });
    const b = span({ type: 'email', start: 5, end: 12, source: 'regex' });
    const merged = mergeDetections([a, b], []);
    expect(merged).toHaveLength(2);
  });
});