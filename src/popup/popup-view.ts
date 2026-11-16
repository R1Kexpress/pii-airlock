import type { InferenceMode } from '../inference/mode';
import type { PresetId } from '../settings/types';
import type { SessionLedger } from '../session/ledger';
import { ledgerTotal } from '../session/ledger';
import { labelForInferenceMode, labelForPreset, labelForPiiType, orderedPiiTypes } from '../ui/format';

export type PopupViewState = 'loading' | 'error' | 'ready';

export interface PopupViewModel {
  viewState: PopupViewState;
  statusText: string;
  enabled: boolean;
  inferenceMode: InferenceMode;
  ledger: SessionLedger;
  activePreset: PresetId;
  errorMessage?: string;
}

export function buildLedgerRows(ledger: SessionLedger): string {
  return orderedPiiTypes()
    .map((type) => {
      const count = ledger[type];
      return `<div class="ledger-row"><span>${labelForPiiType(type)}</span><span class="ledger-count">${count}</span></div>`;
    })
    .join('');
}

export function renderPopupShell(model: PopupViewModel): string {
  if (model.viewState === 'loading') {
    return '<div class="state-block"><div class="spinner" aria-hidden="true"></div>Loading…</div>';
  }
  if (model.viewState === 'error') {
    return `<div class="state-block error">${model.errorMessage ?? 'Could not load status.'}</div>`;
  }

  const total = ledgerTotal(model.ledger);
  const ledgerBlock =
    total === 0
      ? '<p class="muted ledger-empty">No detections recorded this session.</p>'
      : `<div class="ledger-grid">${buildLedgerRows(model.ledger)}</div>`;

  return `
    <header class="popup-header">
      <div>
        <h1>PII Airlock</h1>
        <p id="status" class="status ${model.statusText.includes('connected') ? 'ok' : ''}">${model.statusText}</p>
      </div>
      <span class="badge" data-mode="${model.inferenceMode}">${labelForInferenceMode(model.inferenceMode)}</span>
    </header>
    <section class="card popup-section">
      <div class="row">
        <div>
          <strong>Protection</strong>
          <p class="muted">Preset: ${labelForPreset(model.activePreset)}</p>
        </div>
        <label class="switch">
          <input id="enabled-toggle" type="checkbox" ${model.enabled ? 'checked' : ''} />
          <span class="slider" aria-hidden="true"></span>
          <span class="sr-only">Toggle protection</span>
        </label>
      </div>
    </section>
    <section class="card popup-section">
      <h2 class="section-title">Session ledger</h2>
      <p class="muted section-hint">Counts only — prompt text is never stored.</p>
      ${ledgerBlock}
    </section>
    <footer class="popup-footer">
      <a href="#" id="open-options">Settings</a>
    </footer>
  `;
}