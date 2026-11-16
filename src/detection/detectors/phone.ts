import { scanRegex } from '../utils/scan';

const PHONE_PATTERN =
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b|(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g;

function digitCount(value: string): number {
  return value.replace(/\D/g, '').length;
}

function validatePhone(matched: string, text: string, start: number): boolean {
  const digits = digitCount(matched);
  if (digits < 10 || digits > 15) return false;
  // Avoid matching long card/iban digit runs misread as phones.
  const neighbors = text.slice(Math.max(0, start - 2), start + matched.length + 2);
  if (/\d{12,}/.test(neighbors.replace(/\D/g, ''))) return false;
  return true;
}

export function detectPhone(text: string) {
  return scanRegex(text, {
    type: 'phone',
    pattern: PHONE_PATTERN,
    confidence: 0.78,
    validate: validatePhone,
  });
}