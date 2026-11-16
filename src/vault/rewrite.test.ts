import { describe, expect, it } from 'vitest';
import type { DetectionSpan } from '../detection/types';
import { PlaceholderVault } from './vault';
import { restoreText, rewritePrompt } from './rewrite';

function span(
  partial: Omit<DetectionSpan, 'confidence'> & { confidence?: number },
): DetectionSpan {
  return {
    ...partial,
    confidence: partial.confidence ?? 0.9,
  };
}

/** Assert rewrite metadata without echoing sensitive source text in messages. */
function expectRewrite(
  input: string,
  detections: DetectionSpan[],
  expected: string,
  opts?: { keep?: { start: number; end: number }[] },
): void {
  const vault = new PlaceholderVault();
  const out = rewritePrompt(input, detections, vault, opts?.keep);
  expect(out).toBe(expected);
}

describe('rewritePrompt', () => {
  it('returns empty for empty input', () => {
    expectRewrite('', [], '');
  });

  it('returns unchanged text when there are no detections', () => {
    expectRewrite('hello world', [], 'hello world');
  });

  it('replaces a single span', () => {
    const input = 'reach me at user@example.com please';
    const at = input.indexOf('user@example.com');
    expectRewrite(
      input,
      [span({ type: 'email', start: at, end: at + 16, source: 'regex' })],
      'reach me at [EMAIL_1] please',
    );
  });

  it('handles adjacent spans without dropping characters', () => {
    const left = 'AAA';
    const right = 'BBB';
    const input = `${left}${right}`;
    expectRewrite(
      input,
      [
        span({ type: 'api_key', start: 0, end: 3, source: 'regex' }),
        span({ type: 'api_key', start: 3, end: 6, source: 'regex' }),
      ],
      '[API_KEY_1][API_KEY_2]',
    );
  });

  it('reuses placeholders when values repeat', () => {
    const needle = 'same@x.co';
    const input = `${needle} and ${needle}`;
    const first = input.indexOf(needle);
    const second = first + needle.length + 5;
    expectRewrite(
      input,
      [
        span({ type: 'email', start: first, end: first + needle.length, source: 'regex' }),
        span({
          type: 'email',
          start: second,
          end: second + needle.length,
          source: 'regex',
        }),
      ],
      '[EMAIL_1] and [EMAIL_1]',
    );
  });

  it('coalesces overlapping spans by confidence then length', () => {
    const input = '0123456789';
    expectRewrite(
      input,
      [
        span({
          type: 'phone',
          start: 0,
          end: 10,
          source: 'regex',
          confidence: 0.5,
        }),
        span({
          type: 'ssn',
          start: 2,
          end: 8,
          source: 'model',
          confidence: 0.95,
        }),
      ],
      '01[SSN_1]89',
    );
  });

  it('keeps allow-listed spans unchanged', () => {
    const input = 'public user@example.com secret 111-11-1111';
    const emailStart = input.indexOf('user@example.com');
    const ssnStart = input.indexOf('111-11-1111');
    expectRewrite(
      input,
      [
        span({
          type: 'email',
          start: emailStart,
          end: emailStart + 16,
          source: 'regex',
        }),
        span({ type: 'ssn', start: ssnStart, end: ssnStart + 11, source: 'regex' }),
      ],
      `public user@example.com secret [SSN_1]`,
      { keep: [{ start: emailStart, end: emailStart + 16 }] },
    );
  });

  it('handles unicode indices (emoji before a span)', () => {
    const prefix = '🙂';
    const secret = 'secret';
    const input = `${prefix}${secret}`;
    const start = prefix.length;
    expectRewrite(
      input,
      [span({ type: 'api_key', start, end: start + secret.length, source: 'regex' })],
      `${prefix}[API_KEY_1]`,
    );
  });
});

describe('restoreText', () => {
  it('restores placeholders in order', () => {
    const vault = new PlaceholderVault();
    vault.getOrCreate('email', 'a@b.co');
    vault.getOrCreate('ssn', '000-00-0000');
    const text = 'mail [EMAIL_1] ssn [SSN_1]';
    expect(restoreText(text, vault)).toBe('mail a@b.co ssn 000-00-0000');
  });

  it('leaves unknown tokens unchanged', () => {
    const vault = new PlaceholderVault();
    expect(restoreText('no tokens', vault)).toBe('no tokens');
    expect(restoreText('[EMAIL_1]', vault)).toBe('[EMAIL_1]');
  });

  it('does not partially replace longer numbered placeholders', () => {
    const vault = new PlaceholderVault();
    for (let i = 1; i <= 10; i += 1) {
      vault.getOrCreate('ssn', `v${i}`);
    }
    const text = '[SSN_10] end [SSN_1]';
    expect(restoreText(text, vault)).toBe('v10 end v1');
  });
});