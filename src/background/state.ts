import type { InferenceMode } from '../inference/mode';
import { isInferenceMode } from '../inference/mode';
import {
  SETTINGS_STORAGE_KEY,
  createDefaultSettings,
  parseStoredSettings,
} from '../settings/storage';
import type { AirlockSettings } from '../settings/types';
import {
  LEDGER_SESSION_KEY,
  createEmptyLedger,
  mergeLedgerEntries,
  type SessionLedger,
} from '../session/ledger';

const INFERENCE_MODE_SESSION_KEY = 'airlock_inference_mode';

let settingsCache: AirlockSettings | null = null;
let ledgerCache: SessionLedger | null = null;
let inferenceModeCache: InferenceMode = 'unknown';

export async function loadSettings(): Promise<AirlockSettings> {
  if (settingsCache) return settingsCache;
  const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  settingsCache = parseStoredSettings(result[SETTINGS_STORAGE_KEY]);
  return settingsCache;
}

export async function saveSettings(next: AirlockSettings): Promise<void> {
  settingsCache = next;
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: next });
}

/** Marks preset / telemetry fields as user-owned (options page Save). */
export function markOptionsSaved(settings: AirlockSettings): AirlockSettings {
  return {
    ...settings,
    userOverrides: {
      ...settings.userOverrides,
      presets: true,
      telemetry: true,
    },
  };
}

export async function getEnabled(): Promise<boolean> {
  const s = await loadSettings();
  return s.enabled;
}

export async function setEnabled(enabled: boolean): Promise<AirlockSettings> {
  const s = await loadSettings();
  const next = {
    ...s,
    enabled,
    userOverrides: { ...s.userOverrides, masterEnabled: true },
  };
  await saveSettings(next);
  return next;
}

export async function loadLedger(): Promise<SessionLedger> {
  if (ledgerCache) return ledgerCache;
  const result = await chrome.storage.session.get(LEDGER_SESSION_KEY);
  const raw = result[LEDGER_SESSION_KEY];
  if (typeof raw === 'object' && raw !== null) {
    ledgerCache = createEmptyLedger();
    ledgerCache = mergeLedgerEntries(ledgerCache, raw as Partial<SessionLedger>);
    return ledgerCache;
  }
  ledgerCache = createEmptyLedger();
  return ledgerCache;
}

async function persistLedger(ledger: SessionLedger): Promise<void> {
  ledgerCache = ledger;
  await chrome.storage.session.set({ [LEDGER_SESSION_KEY]: ledger });
}

export async function recordLedgerIncrements(
  increments: Partial<SessionLedger>,
): Promise<SessionLedger> {
  const ledger = mergeLedgerEntries(await loadLedger(), increments);
  await persistLedger(ledger);
  return ledger;
}

export async function getInferenceMode(): Promise<InferenceMode> {
  if (inferenceModeCache !== 'unknown') return inferenceModeCache;
  const result = await chrome.storage.session.get(INFERENCE_MODE_SESSION_KEY);
  const raw = result[INFERENCE_MODE_SESSION_KEY];
  if (isInferenceMode(raw)) {
    inferenceModeCache = raw;
    return raw;
  }
  return 'unknown';
}

export async function setInferenceMode(mode: InferenceMode): Promise<void> {
  if (!isInferenceMode(mode)) return;
  inferenceModeCache = mode;
  await chrome.storage.session.set({ [INFERENCE_MODE_SESSION_KEY]: mode });
}

export function resetSettingsCacheForTests(): void {
  settingsCache = null;
  ledgerCache = null;
  inferenceModeCache = 'unknown';
}

export async function ensureDefaultSettings(): Promise<void> {
  const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  if (result[SETTINGS_STORAGE_KEY] === undefined) {
    await saveSettings(createDefaultSettings());
  }
}