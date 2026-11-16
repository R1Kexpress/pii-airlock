import { detectApiKey } from './detectors/api-key';
import { detectCreditCard } from './detectors/credit-card';
import { detectEmail } from './detectors/email';
import { detectIban } from './detectors/iban';
import { detectPhone } from './detectors/phone';
import { detectSsn } from './detectors/ssn';
import { mergeDetections } from './merge';
import type { DetectionSpan } from './types';

/**
 * Run all regex PII detectors on in-memory text.
 * Callers must not log or persist `text` (rehydration slice owns buffering rules).
 */
export function detectPiiRegex(text: string): DetectionSpan[] {
  const spans: DetectionSpan[] = [
    ...detectSsn(text),
    ...detectCreditCard(text),
    ...detectEmail(text),
    ...detectPhone(text),
    ...detectApiKey(text),
    ...detectIban(text),
  ];
  return mergeDetections(spans, []);
}