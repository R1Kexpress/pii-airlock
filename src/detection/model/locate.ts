import type { DetectionSpan } from '../types';
import type { ModelFinding } from './parse';

export const MAX_MODEL_SPANS = 500;

export interface LocateResult {
  spans: DetectionSpan[];
  /** Findings whose text does not occur verbatim in the input (model hallucinations). */
  droppedFindings: number;
}

/**
 * Models are unreliable at character offsets, so they return the matched text and we locate
 * every verbatim occurrence ourselves. Findings that cannot be located are dropped.
 */
export function locateFindings(
  input: string,
  findings: ModelFinding[],
  confidence: number,
): LocateResult {
  const spans = new Map<string, DetectionSpan>();
  let droppedFindings = 0;

  for (const finding of findings) {
    let from = 0;
    let found = false;
    while (spans.size < MAX_MODEL_SPANS) {
      const start = input.indexOf(finding.text, from);
      if (start === -1) break;
      const end = start + finding.text.length;
      found = true;
      spans.set(`${finding.type}:${start}:${end}`, {
        type: finding.type,
        start,
        end,
        confidence,
        source: 'model',
      });
      from = end;
    }
    if (!found) droppedFindings += 1;
  }

  return {
    spans: [...spans.values()].sort((a, b) => a.start - b.start || a.end - b.end),
    droppedFindings,
  };
}
