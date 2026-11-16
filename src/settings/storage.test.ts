import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESETS } from './presets';
import {
  createDefaultSettings,
  parseStoredSettings,
  enabledTypesFromCategories,
} from './storage';

describe('settings storage', () => {
  it('creates defaults with all personal categories enabled', () => {
    const s = createDefaultSettings();
    expect(s.enabled).toBe(true);
    expect(s.activePreset).toBe('personal');
    expect(s.presets.personal.email).toBe(true);
  });

  it('parses valid stored settings', () => {
    const parsed = parseStoredSettings({
      enabled: false,
      activePreset: 'work',
      presets: DEFAULT_PRESETS,
    });
    expect(parsed.enabled).toBe(false);
    expect(parsed.activePreset).toBe('work');
  });

  it('falls back on corrupt storage', () => {
    const parsed = parseStoredSettings({ presets: { personal: 'nope' } });
    expect(parsed.activePreset).toBe('personal');
    expect(parsed.presets.work.api_key).toBe(true);
  });

  it('lists enabled types from categories', () => {
    const types = enabledTypesFromCategories(DEFAULT_PRESETS.work);
    expect(types).toContain('email');
    expect(types).not.toContain('ssn');
  });
});