import { PRESET_IDS } from '../settings/types';
import type { AirlockSettings, PresetId } from '../settings/types';
import { labelForPreset, labelForPiiType, orderedPiiTypes } from '../ui/format';

export type OptionsViewState = 'loading' | 'error' | 'ready';

export interface OptionsViewModel {
  viewState: OptionsViewState;
  settings?: AirlockSettings;
  errorMessage?: string;
  savedFlash?: boolean;
}

export function renderOptions(model: OptionsViewModel): string {
  if (model.viewState === 'loading') {
    return '<div class="state-block"><div class="spinner" aria-hidden="true"></div>Loading settings…</div>';
  }
  if (model.viewState === 'error') {
    return `<div class="state-block error">${model.errorMessage ?? 'Failed to load settings.'}</div>`;
  }
  if (!model.settings) {
    return '<div class="state-block error">No settings available.</div>';
  }

  const cards = PRESET_IDS.map((id) => presetCard(id, model.settings!)).join('');

  const telemetryChecked = model.settings.telemetryOptIn ? 'checked' : '';

  return `
    <section class="card options-telemetry">
      <h3>Anonymous telemetry</h3>
      <p class="muted">
        When enabled, the extension sends daily increment-only counters (category and inference
        mode). No prompt text, detected values, or user identifiers are included.
      </p>
      <label>
        <input type="checkbox" id="telemetry-opt-in" ${telemetryChecked} />
        Share anonymized usage counters
      </label>
    </section>
    <div class="preset-grid">${cards}</div>
    <div class="options-actions">
      <button type="button" id="save-settings" class="btn primary">Save</button>
      ${model.savedFlash ? '<span class="muted" role="status">Saved</span>' : ''}
    </div>
  `;
}

function presetCard(id: PresetId, settings: AirlockSettings): string {
  const cats = settings.presets[id];
  const checks = orderedPiiTypes()
    .map((type) => {
      const checked = cats[type] ? 'checked' : '';
      return `<label><input type="checkbox" data-preset="${id}" data-category="${type}" ${checked} />${labelForPiiType(type)}</label>`;
    })
    .join('');

  const active = settings.activePreset === id ? 'checked' : '';

  return `
    <section class="card preset-card" data-preset-card="${id}">
      <div class="preset-head">
        <h3>${labelForPreset(id)}</h3>
        <label><input type="radio" name="active-preset" value="${id}" ${active} /> Active preset</label>
      </div>
      <div class="category-grid">${checks}</div>
    </section>
  `;
}