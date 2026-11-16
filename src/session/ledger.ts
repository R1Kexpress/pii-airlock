import { PII_TYPES, type PiiType } from '../detection/types';

export type SessionLedger = Record<PiiType, number>;

export const LEDGER_SESSION_KEY = 'airlock_session_ledger';

export function createEmptyLedger(): SessionLedger {
  return Object.fromEntries(PII_TYPES.map((t) => [t, 0])) as SessionLedger;
}

export function incrementLedger(
  ledger: SessionLedger,
  type: PiiType,
  by = 1,
): SessionLedger {
  if (by <= 0) return ledger;
  return { ...ledger, [type]: ledger[type] + by };
}

export function ledgerTotal(ledger: SessionLedger): number {
  return PII_TYPES.reduce((sum, t) => sum + ledger[t], 0);
}

export function mergeLedgerEntries(
  target: SessionLedger,
  increments: Partial<SessionLedger>,
): SessionLedger {
  const next = { ...target };
  for (const t of PII_TYPES) {
    const add = increments[t];
    if (typeof add === 'number' && add > 0) {
      next[t] += add;
    }
  }
  return next;
}