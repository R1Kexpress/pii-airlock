import {
  LOCAL_DEFAULT_POLICY,
  REMOTE_POLICY_STORAGE_KEY,
  type RemotePolicy,
} from '../firebase/policy-keys';
import { applyRemotePolicy } from '../settings/apply-remote-policy';
import { getModeSetting, setModeFromPolicy } from '../inference/settings';
import {
  InferenceMessageType,
  INFERENCE_HOST_TARGET,
  type PolicySyncResponse,
} from '../inference/messages';
import { ensureOffscreenDocument } from '../inference/offscreen-manager';
import { loadSettings, saveSettings } from './state';

async function sendPolicySync(): Promise<PolicySyncResponse> {
  await ensureOffscreenDocument();
  try {
    const response = (await chrome.runtime.sendMessage({
      target: INFERENCE_HOST_TARGET,
      type: InferenceMessageType.HOST_SYNC_POLICY,
    })) as PolicySyncResponse | undefined;
    return response ?? { ok: false, errorCode: 'host-bad-response' };
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const response = (await chrome.runtime.sendMessage({
      target: INFERENCE_HOST_TARGET,
      type: InferenceMessageType.HOST_SYNC_POLICY,
    })) as PolicySyncResponse | undefined;
    return response ?? { ok: false, errorCode: 'host-unreachable' };
  }
}

export async function loadCachedRemotePolicy(): Promise<RemotePolicy | undefined> {
  const stored = await chrome.storage.local.get(REMOTE_POLICY_STORAGE_KEY);
  const raw = stored[REMOTE_POLICY_STORAGE_KEY];
  if (typeof raw !== 'object' || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.killSwitch !== 'boolean' ||
    typeof obj.defaultInferenceMode !== 'string' ||
    typeof obj.presets !== 'object' ||
    obj.presets === null
  ) {
    return undefined;
  }
  return raw as RemotePolicy;
}

async function cacheRemotePolicy(policy: RemotePolicy): Promise<void> {
  await chrome.storage.local.set({ [REMOTE_POLICY_STORAGE_KEY]: policy });
}

export async function applyPolicyToStoredSettings(policy: RemotePolicy): Promise<void> {
  const [settings, mode] = await Promise.all([loadSettings(), getModeSetting()]);
  const effective = applyRemotePolicy(settings, policy, mode);
  await saveSettings(effective.settings);
  if (effective.inferenceMode !== mode) {
    await setModeFromPolicy(effective.inferenceMode);
  }
}

/**
 * Pull Remote Config policy from the offscreen host (DOM context), fall back to cache or local defaults.
 */
export async function syncRemotePolicy(): Promise<RemotePolicy> {
  const response = await sendPolicySync();
  let policy: RemotePolicy;
  if (response.ok) {
    policy = response.policy;
    await cacheRemotePolicy(policy);
  } else {
    policy = (await loadCachedRemotePolicy()) ?? LOCAL_DEFAULT_POLICY;
    await applyPolicyToStoredSettings(policy);
    return policy;
  }
  await applyPolicyToStoredSettings(policy);
  return policy;
}