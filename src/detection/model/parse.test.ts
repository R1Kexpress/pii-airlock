import { describe, expect, it } from 'vitest';
import { ModelOutputError, parseModelFindings } from './parse';

describe('parseModelFindings', () => {
  it('parses a valid response', () => {
    const raw = JSON.stringify({
      findings: [
        { type: 'email', text: ' a@b.co ' },
        { type: 'ssn', text: '123-45-6789' },
      ],
    });
    expect(parseModelFindings(raw)).toEqual([
      { type: 'email', text: 'a@b.co' },
      { type: 'ssn', text: '123-45-6789' },
    ]);
  });

  it('accepts an empty findings array', () => {
    expect(parseModelFindings('{"findings":[]}')).toEqual([]);
  });

  it('strips a single markdown code fence', () => {
    expect(parseModelFindings('```json\n{"findings":[]}\n```')).toEqual([]);
  });

  it.each([
    ['not json', 'sure! here you go', 'not-json'],
    ['truncated json', '{"findings":[{"type":"email"', 'not-json'],
    ['array root', '[]', 'not-an-object'],
    ['null root', 'null', 'not-an-object'],
    ['missing findings', '{"items":[]}', 'findings-not-array'],
    ['findings not array', '{"findings":{}}', 'findings-not-array'],
    ['non-object finding', '{"findings":["x"]}', 'finding-not-object'],
    ['unknown type', '{"findings":[{"type":"passport","text":"x"}]}', 'finding-bad-type'],
    ['non-string text', '{"findings":[{"type":"email","text":5}]}', 'finding-bad-text'],
    ['blank text', '{"findings":[{"type":"email","text":"  "}]}', 'finding-bad-text-length'],
    [
      'oversized text',
      JSON.stringify({ findings: [{ type: 'email', text: 'x'.repeat(513) }] }),
      'finding-bad-text-length',
    ],
    [
      'too many findings',
      JSON.stringify({ findings: Array.from({ length: 201 }, () => ({ type: 'email', text: 'x' })) }),
      'too-many-findings',
    ],
  ])('rejects %s', (_name, raw, reason) => {
    expect(() => parseModelFindings(raw)).toThrow(ModelOutputError);
    try {
      parseModelFindings(raw);
    } catch (error) {
      expect((error as ModelOutputError).reason).toBe(reason);
    }
  });

  it('never echoes model output in error messages', () => {
    const secret = 'SECRET-123-45-6789';
    try {
      parseModelFindings(`{"findings":[{"type":"passport","text":"${secret}"}]}`);
      expect.unreachable();
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(secret);
    }
  });
});
