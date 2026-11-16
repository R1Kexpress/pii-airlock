import type { FirebaseApp } from 'firebase/app';
import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  type RemoteConfig,
} from 'firebase/remote-config';
import { PII_TYPES } from '../detection/types';
import {
  INFERENCE_MODE_SETTINGS,
  type InferenceModeSetting,
} from '../inference/modes';
import { PRESET_IDS, type CategorySettings, type PresetStore } from '../settings/types';
import {
  LOCAL_DEFAULT_POLICY,
  REMOTE_CONFIG_KEYS,
  categoriesKeyForPreset,
  remoteConfigDefaultStrings,
  type RemotePolicy,
} from './policy-keys';

export const REMOTE_POLICY_STORAGE_KEY = 'airlock_remote_policy_cache';

/** Dev-friendly fetch interval; raise in production via Remote Config settings if desired. */
export const REMOTE_CONFIG_MIN_FETCH_MS = 3_600_000;

let remoteConfigHandle: RemoteConfig | undefined;

export function getOrCreateRemoteConfig(app: FirebaseApp): RemoteConfig {
  if (remoteConfigHandle) return remoteConfigHandle;
  const rc = getRemoteConfig(app);
  rc.settings.minimumFetchIntervalMillis = REMOTE_CONFIG_MIN_FETCH_MS;
  rc.defaultConfig = remoteConfigDefaultStrings();
  remoteConfigHandle = rc;
  return rc;
}

export function resetRemoteConfigForTests(): void {
  remoteConfigHandle = undefined;
}

function parseInferenceMode(raw: string): InferenceModeSetting {
  const trimmed = raw.trim();
  if ((INFERENCE_MODE_SETTINGS as readonly string[]).includes(trimmed)) {
    return trimmed as InferenceModeSetting;
  }
  return LOCAL_DEFAULT_POLICY.defaultInferenceMode;
}

function parseCategoryJson(raw: string, fallback: CategorySettings): CategorySettings {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...fallback };
    const out = { ...fallback };
    for (const t of PII_TYPES) {
      const v = (parsed as Record<string, unknown>)[t];
      if (typeof v === 'boolean') out[t] = v;
    }
    return out;
  } catch {
    return { ...fallback };
  }
}

export function readPolicyFromRemoteConfig(remoteConfig: RemoteConfig): RemotePolicy {
  const killRaw = getValue(remoteConfig, REMOTE_CONFIG_KEYS.killSwitch).asString();
  const killSwitch = killRaw.trim().toLowerCase() === 'true';
  const modeRaw = getValue(remoteConfig, REMOTE_CONFIG_KEYS.defaultInferenceMode).asString();
  const defaultInferenceMode = parseInferenceMode(modeRaw);

  const presets = {} as PresetStore;
  for (const id of PRESET_IDS) {
    const key = categoriesKeyForPreset(id);
    const json = getValue(remoteConfig, key).asString();
    presets[id] = parseCategoryJson(json, LOCAL_DEFAULT_POLICY.presets[id]);
  }

  return { killSwitch, defaultInferenceMode, presets };
}

// TODO(verify): Remote Config fetch from chrome-extension:// origin (Installations + network).
/**
 * Fetch Remote Config in an extension page (offscreen document). Uses local `defaultConfig` when
 * offline or when fetch fails.
 */
export async function fetchRemotePolicy(app: FirebaseApp): Promise<{
  policy: RemotePolicy;
  source: 'remote' | 'local';
}> {
  const remoteConfig = getOrCreateRemoteConfig(app);
  try {
    await fetchAndActivate(remoteConfig);
    return { policy: readPolicyFromRemoteConfig(remoteConfig), source: 'remote' };
  } catch {
    return { policy: readPolicyFromRemoteConfig(remoteConfig), source: 'local' };
  }
}