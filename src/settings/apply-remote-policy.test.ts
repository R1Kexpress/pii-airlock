import { describe, expect, it } from 'vitest';
import { LOCAL_DEFAULT_POLICY } from '../firebase/policy-keys';
import { createDefaultSettings } from './storage';
import { applyRemotePolicy } from './apply-remote-policy';

describe('applyRemotePolicy', () => {
  it('applies default inference mode when user has not overridden', () => {
    const settings = createDefaultSettings();
    const policy = {
      ...LOCAL_DEFAULT_POLICY,
      defaultInferenceMode: 'only-in-cloud' as const,
    };
    const result = applyRemotePolicy(settings, policy, 'prefer-on-device');
    expect(result.inferenceMode).toBe('only-in-cloud');
  });

  it('keeps user inference mode when overridden', () => {
    const settings = createDefaultSettings();
    settings.userOverrides.inferenceMode = true;
    const policy = {
      ...LOCAL_DEFAULT_POLICY,
      defaultInferenceMode: 'only-in-cloud' as const,
    };
    const result = applyRemotePolicy(settings, policy, 'only-on-device');
    expect(result.inferenceMode).toBe('only-on-device');
  });

  it('forces kill switch off even when user enabled protection', () => {
    const settings = createDefaultSettings();
    settings.enabled = true;
    settings.userOverrides.masterEnabled = true;
    const policy = { ...LOCAL_DEFAULT_POLICY, killSwitch: true };
    const result = applyRemotePolicy(settings, policy, 'prefer-on-device');
    expect(result.settings.enabled).toBe(false);
  });

  it('replaces presets from policy until user saves options', () => {
    const settings = createDefaultSettings();
    settings.presets.work.email = false;
    const policy = {
      ...LOCAL_DEFAULT_POLICY,
      presets: {
        ...LOCAL_DEFAULT_POLICY.presets,
        work: { ...LOCAL_DEFAULT_POLICY.presets.work, email: true, ssn: true },
      },
    };
    const result = applyRemotePolicy(settings, policy, 'prefer-on-device');
    expect(result.settings.presets.work.email).toBe(true);
    expect(result.settings.presets.work.ssn).toBe(true);
  });

  it('skips preset replacement after user saves options', () => {
    const settings = createDefaultSettings();
    settings.userOverrides.presets = true;
    settings.presets.work.email = false;
    const policy = {
      ...LOCAL_DEFAULT_POLICY,
      presets: {
        ...LOCAL_DEFAULT_POLICY.presets,
        work: { ...LOCAL_DEFAULT_POLICY.presets.work, email: true },
      },
    };
    const result = applyRemotePolicy(settings, policy, 'prefer-on-device');
    expect(result.settings.presets.work.email).toBe(false);
  });
});