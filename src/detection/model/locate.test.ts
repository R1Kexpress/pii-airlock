import { describe, expect, it } from 'vitest';
import { locateFindings, MAX_MODEL_SPANS } from './locate';

describe('locateFindings', () => {
  it('maps finding text to every verbatim occurrence', () => {
    const input = 'mail a@b.co then again a@b.co';
    const { spans, droppedFindings } = locateFindings(
      input,
      [{ type: 'email', text: 'a@b.co' }],
      0.7,
    );
    expect(droppedFindings).toBe(0);
    expect(spans).toEqual([
      { type: 'email', start: 5, end: 11, confidence: 0.7, source: 'model' },
      { type: 'email', start: 23, end: 29, confidence: 0.7, source: 'model' },
    ]);
    for (const s of spans) expect(input.slice(s.start, s.end)).toBe('a@b.co');
  });

  it('drops findings that do not occur in the input', () => {
    const { spans, droppedFindings } = locateFindings(
      'nothing here',
      [{ type: 'ssn', text: '123-45-6789' }],
      0.7,
    );
    expect(spans).toEqual([]);
    expect(droppedFindings).toBe(1);
  });

  it('dedupes repeated findings and sorts by position', () => {
    const { spans } = locateFindings(
      'b@x.io a@x.io',
      [
        { type: 'email', text: 'a@x.io' },
        { type: 'email', text: 'b@x.io' },
        { type: 'email', text: 'a@x.io' },
      ],
      0.5,
    );
    expect(spans.map((s) => s.start)).toEqual([0, 7]);
  });

  it('caps the number of spans', () => {
    const { spans } = locateFindings('a'.repeat(MAX_MODEL_SPANS + 100), [{ type: 'api_key', text: 'a' }], 0.5);
    expect(spans).toHaveLength(MAX_MODEL_SPANS);
  });
});
