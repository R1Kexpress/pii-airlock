import type { DetectionSpan } from '../detection/types';
import type { RunSource } from '../inference/modes';
import { PII_TYPES, type PiiType } from '../detection/types';
import { ensureOffscreenDocument } from '../inference/offscreen-manager';
import {
  INFERENCE_HOST_TARGET,
  InferenceMessageType,
  type TelemetrySubmitResponse,
} from '../inference/messages';
import { loadSettings } from './state';

function spansToCategoryCounts(spans: DetectionSpan[]): Partial<Record<PiiType, number>> {
  const counts: Partial<Record<PiiType, number>> = {};
  for (const span of spans) {
    counts[span.type] = (counts[span.type] ?? 0) + 1;
  }
  return counts;
}

function ledgerIncrementsToCounts(
  increments: Partial<Record<PiiType, number>>,
): Partial<Record<PiiType, number>> {
  const counts: Partial<Record<PiiType, number>> = {};
  for (const t of PII_TYPES) {
    const n = increments[t];
    if (typeof n === 'number' && n > 0) counts[t] = n;
  }
  return counts;
}

async function sendTelemetry(
  categories: Partial<Record<PiiType, number>>,
  mode?: RunSource,
): Promise<void> {
  if (Object.keys(categories).length === 0 && !mode) return;
  const settings = await loadSettings();
  if (!settings.telemetryOptIn) return;

  await ensureOffscreenDocument();
  try {
    const response = (await chrome.runtime.sendMessage({
      target: INFERENCE_HOST_TARGET,
      type: InferenceMessageType.HOST_SUBMIT_TELEMETRY,
      categories,
      mode,
    })) as TelemetrySubmitResponse | undefined;
    void response;
  } catch {
    // Telemetry must never block detection or ledger updates.
  }
}

export async function maybeSubmitSpansTelemetry(
  spans: DetectionSpan[],
  mode?: RunSource,
): Promise<void> {
  await sendTelemetry(spansToCategoryCounts(spans), mode);
}

export async function maybeSubmitLedgerTelemetry(
  increments: Partial<Record<PiiType, number>>,
): Promise<void> {
  await sendTelemetry(ledgerIncrementsToCounts(increments));
}