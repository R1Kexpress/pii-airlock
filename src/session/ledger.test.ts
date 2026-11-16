import { describe, expect, it } from 'vitest';
import {
  createEmptyLedger,
  incrementLedger,
  ledgerTotal,
  mergeLedgerEntries,
} from './ledger';

describe('session ledger', () => {
  it('starts empty', () => {
    const l = createEmptyLedger();
    expect(ledgerTotal(l)).toBe(0);
  });

  it('increments by type', () => {
    const l = incrementLedger(createEmptyLedger(), 'email', 2);
    expect(l.email).toBe(2);
    expect(l.ssn).toBe(0);
  });

  it('merges partial increments', () => {
    const base = createEmptyLedger();
    const merged = mergeLedgerEntries(base, { phone: 1, email: 3 });
    expect(ledgerTotal(merged)).toBe(4);
  });
});