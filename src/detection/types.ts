export const PII_TYPES = [
  'ssn',
  'credit_card',
  'email',
  'phone',
  'api_key',
  'iban',
] as const;

export type PiiType = (typeof PII_TYPES)[number];

export const DETECTION_SOURCES = ['regex', 'model'] as const;

export type DetectionSource = (typeof DETECTION_SOURCES)[number];

export interface DetectionSpan {
  type: PiiType;
  start: number;
  end: number;
  /** 0–1 heuristic; regex uses validation strength, model uses model score later. */
  confidence: number;
  source: DetectionSource;
}

export function spansOverlap(a: DetectionSpan, b: DetectionSpan): boolean {
  return a.start < b.end && b.start < a.end;
}