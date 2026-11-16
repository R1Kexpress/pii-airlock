import { scanRegex } from '../utils/scan';
import { isValidIban } from '../utils/iban';

const IBAN_PATTERN =
  /\b[A-Z]{2}\d{2}[ ][A-Z0-9]{4}(?:[ ][A-Z0-9]{4}){2,7}(?:[ ][A-Z0-9]{1,4})?\b|\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi;

export function detectIban(text: string) {
  return scanRegex(text, {
    type: 'iban',
    pattern: IBAN_PATTERN,
    confidence: 0.87,
    validate: (m) => isValidIban(m),
  });
}