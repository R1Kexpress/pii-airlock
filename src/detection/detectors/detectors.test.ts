import { describe, expect, it } from 'vitest';
import { detectPiiRegex } from '../regex';
import { detectApiKey } from './api-key';
import { detectCreditCard } from './credit-card';
import { detectEmail } from './email';
import { detectIban } from './iban';
import { detectPhone } from './phone';
import { detectSsn } from './ssn';

describe('SSN detector', () => {
  it('finds dashed and undashed SSNs', () => {
    const text = 'Contact 123-45-6789 or backup 234567890 in notes.';
    const spans = detectSsn(text);
    expect(spans.some((s) => s.type === 'ssn' && text.slice(s.start, s.end) === '123-45-6789')).toBe(true);
    expect(spans.some((s) => text.slice(s.start, s.end) === '234567890')).toBe(true);
  });

  it('rejects invalid SSN area 666', () => {
    const spans = detectSsn('bad 666-12-3456 here');
    expect(spans).toHaveLength(0);
  });
});

describe('credit card detector', () => {
  it('accepts Luhn-valid Visa', () => {
    const text = 'pay 4532 0151 1283 0366 thanks';
    const spans = detectCreditCard(text);
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('credit_card');
  });

  it('rejects invalid Luhn', () => {
    const spans = detectCreditCard('card 4111 1111 1111 1112');
    expect(spans).toHaveLength(0);
  });
});

describe('email detector', () => {
  it('detects typical emails', () => {
    const text = 'reach me at ada.lovelace@example.co.uk please';
    const spans = detectEmail(text);
    expect(spans).toHaveLength(1);
    expect(text.slice(spans[0].start, spans[0].end)).toBe('ada.lovelace@example.co.uk');
  });

  it('avoids obvious false positive without domain TLD depth', () => {
    expect(detectEmail('file@localhost')).toHaveLength(0);
  });
});

describe('phone detector', () => {
  it('detects US phone formats', () => {
    const text = 'Call (415) 555-2671 tomorrow';
    const spans = detectPhone(text);
    expect(spans.length).toBeGreaterThanOrEqual(1);
  });
});

describe('API key detector', () => {
  it('detects OpenAI-style keys', () => {
    const key = 'sk-' + 'a'.repeat(24);
    const spans = detectApiKey(`key=${key}`);
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('api_key');
  });

  it('detects AWS access key id pattern', () => {
    const spans = detectApiKey('AKIAIOSFODNN7EXAMPLE');
    expect(spans).toHaveLength(1);
  });
});

describe('IBAN detector', () => {
  it('validates a known-good German IBAN', () => {
    const iban = 'DE89 3704 0044 0532 0130 00';
    const spans = detectIban(`wire ${iban}`);
    expect(spans).toHaveLength(1);
    expect(spans[0].type).toBe('iban');
  });

  it('rejects bad check digits', () => {
    const spans = detectIban('DE00 3704 0044 0532 0130 00');
    expect(spans).toHaveLength(0);
  });
});

describe('detectPiiRegex integration', () => {
  it('returns typed spans with source regex', () => {
    const text =
      'Email jane@example.com and key sk-' + 'z'.repeat(24) + ' end';
    const spans = detectPiiRegex(text);
    const types = new Set(spans.map((s) => s.type));
    expect(types.has('email')).toBe(true);
    expect(types.has('api_key')).toBe(true);
    spans.forEach((s) => {
      expect(s.source).toBe('regex');
      expect(s.confidence).toBeGreaterThan(0);
      expect(s.end).toBeGreaterThan(s.start);
    });
  });
});