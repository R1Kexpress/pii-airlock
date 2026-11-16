import { scanRegex } from '../utils/scan';
import { passesLuhn } from '../utils/luhn';

const CARD_PATTERN =
  /\b(?:\d{4}[-\s]?){3}\d{1,4}\b|\b(?:\d{4}[-\s]?){2}\d{4}[-\s]?\d{1,4}\b/g;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function detectCreditCard(text: string) {
  return scanRegex(text, {
    type: 'credit_card',
    pattern: CARD_PATTERN,
    confidence: 0.82,
    validate: (m) => passesLuhn(digitsOnly(m)),
  });
}