import { describe, expect, it } from 'vitest';
import { createEmptyLedger } from '../session/ledger';
import { buildLedgerRows, renderPopupShell } from './popup-view';

describe('popup view', () => {
  it('shows empty ledger message', () => {
    const html = renderPopupShell({
      viewState: 'ready',
      statusText: 'Extension connected',
      enabled: true,
      inferenceMode: 'unknown',
      ledger: createEmptyLedger(),
      activePreset: 'personal',
    });
    expect(html).toContain('No detections recorded');
  });

  it('renders ledger rows', () => {
    const ledger = createEmptyLedger();
    ledger.email = 2;
    const rows = buildLedgerRows(ledger);
    expect(rows).toContain('Email');
    expect(rows).toContain('2');
  });
});