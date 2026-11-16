import type { FirebaseApp } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getValue = vi.fn();
const fetchAndActivate = vi.fn();
const getRemoteConfig = vi.fn();

vi.mock('firebase/remote-config', () => ({
  fetchAndActivate: (...args: unknown[]) => fetchAndActivate(...args),
  getRemoteConfig: (...args: unknown[]) => getRemoteConfig(...args),
  getValue: (...args: unknown[]) => getValue(...args),
}));

import {
  fetchRemotePolicy,
  readPolicyFromRemoteConfig,
  resetRemoteConfigForTests,
} from './remote-config-policy';
import { REMOTE_CONFIG_KEYS } from './policy-keys';

const fakeApp = {} as FirebaseApp;
const fakeRc = { settings: {}, defaultConfig: {} };

beforeEach(() => {
  resetRemoteConfigForTests();
  getRemoteConfig.mockReturnValue(fakeRc);
  fetchAndActivate.mockReset();
  getValue.mockReset();
});

function valueAsString(s: string) {
  return { asString: () => s };
}

describe('readPolicyFromRemoteConfig', () => {
  it('parses kill switch and inference mode', () => {
    getValue.mockImplementation((_rc: unknown, key: string) => {
      if (key === REMOTE_CONFIG_KEYS.killSwitch) return valueAsString('true');
      if (key === REMOTE_CONFIG_KEYS.defaultInferenceMode) return valueAsString('only-in-cloud');
      if (key.startsWith('airlock_categories_')) {
        return valueAsString('{"email":true,"phone":false,"ssn":true,"credit_card":true,"api_key":true,"iban":false}');
      }
      return valueAsString('');
    });
    const policy = readPolicyFromRemoteConfig(fakeRc as never);
    expect(policy.killSwitch).toBe(true);
    expect(policy.defaultInferenceMode).toBe('only-in-cloud');
    expect(policy.presets.work.email).toBe(true);
    expect(policy.presets.work.phone).toBe(false);
  });
});

describe('fetchRemotePolicy', () => {
  it('returns remote source when fetch succeeds', async () => {
    fetchAndActivate.mockResolvedValue(true);
    getValue.mockImplementation((_rc: unknown, key: string) => {
      if (key === REMOTE_CONFIG_KEYS.killSwitch) return valueAsString('false');
      if (key === REMOTE_CONFIG_KEYS.defaultInferenceMode) return valueAsString('prefer-on-device');
      if (key.startsWith('airlock_categories_')) {
        return valueAsString('{"email":true,"phone":true,"ssn":true,"credit_card":true,"api_key":true,"iban":true}');
      }
      return valueAsString('');
    });
    const { source, policy } = await fetchRemotePolicy(fakeApp);
    expect(source).toBe('remote');
    expect(policy.killSwitch).toBe(false);
  });

  it('falls back to defaultConfig when fetch fails', async () => {
    fetchAndActivate.mockRejectedValue(new Error('offline'));
    getValue.mockImplementation((_rc: unknown, key: string) => {
      if (key === REMOTE_CONFIG_KEYS.killSwitch) return valueAsString('false');
      if (key === REMOTE_CONFIG_KEYS.defaultInferenceMode) return valueAsString('prefer-on-device');
      if (key.startsWith('airlock_categories_')) {
        return valueAsString('{"email":true,"phone":true,"ssn":true,"credit_card":true,"api_key":true,"iban":true}');
      }
      return valueAsString('');
    });
    const { source } = await fetchRemotePolicy(fakeApp);
    expect(source).toBe('local');
  });
});