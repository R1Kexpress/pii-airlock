import { scanRegex } from '../utils/scan';

const SSN_PATTERN =
  /\b(?!000|666|9\d{2})(\d{3})[- ]?(?!00)(\d{2})[- ]?(?!0000)(\d{4})\b/g;

function validateSsn(matched: string): boolean {
  const digits = matched.replace(/\D/g, '');
  if (digits.length !== 9) return false;
  const area = Number(digits.slice(0, 3));
  const group = Number(digits.slice(3, 5));
  const serial = Number(digits.slice(5, 9));
  if (area === 0 || area === 666 || area >= 900) return false;
  if (group === 0) return false;
  if (serial === 0) return false;
  return true;
}

export function detectSsn(text: string) {
  return scanRegex(text, {
    type: 'ssn',
    pattern: SSN_PATTERN,
    confidence: 0.88,
    validate: (m) => validateSsn(m),
  });
}