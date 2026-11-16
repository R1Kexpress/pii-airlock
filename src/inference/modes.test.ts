import { InferenceMode, InferenceSource } from 'firebase/ai';
import { describe, expect, it } from 'vitest';
import { mapInferenceSource, toFirebaseMode } from './firebase-mapping';
import {
  DEFAULT_INFERENCE_MODE,
  INFERENCE_MODE_SETTINGS,
  buildRunReport,
  isInferenceModeSetting,
  summarizeSources,
} from './modes';

// These use the real installed SDK constants (not mocked) as a contract check.
describe('mode mapping against the installed SDK', () => {
  it('defaults to prefer-on-device', () => {
    expect(DEFAULT_INFERENCE_MODE).toBe('prefer-on-device');
    expect(toFirebaseMode(DEFAULT_INFERENCE_MODE)).toBe(InferenceMode.PREFER_ON_DEVICE);
  });

  it('maps every setting to a distinct SDK mode', () => {
    expect(toFirebaseMode('prefer-on-device')).toBe('prefer_on_device');
    expect(toFirebaseMode('only-on-device')).toBe('only_on_device');
    expect(toFirebaseMode('only-in-cloud')).toBe('only_in_cloud');
    const mapped = INFERENCE_MODE_SETTINGS.map(toFirebaseMode);
    expect(new Set(mapped).size).toBe(INFERENCE_MODE_SETTINGS.length);
  });

  it('maps inferenceSource to a label', () => {
    expect(mapInferenceSource(InferenceSource.ON_DEVICE)).toBe('on-device');
    expect(mapInferenceSource(InferenceSource.IN_CLOUD)).toBe('cloud');
  });

  it('never reports on-device unless the SDK says so', () => {
    expect(mapInferenceSource(undefined)).toBe('unknown');
    expect(mapInferenceSource('')).toBe('unknown');
    expect(mapInferenceSource('ON_DEVICE')).toBe('unknown');
    expect(mapInferenceSource('on-device')).toBe('unknown');
    expect(mapInferenceSource('local')).toBe('unknown');
  });
});

describe('summarizeSources', () => {
  it('claims on-device only when every attempt was on-device', () => {
    expect(summarizeSources(['on-device'])).toBe('on-device');
    expect(summarizeSources(['on-device', 'on-device'])).toBe('on-device');
    expect(summarizeSources(['on-device', 'cloud'])).toBe('mixed');
    expect(summarizeSources(['on-device', 'unknown'])).toBe('unknown');
    expect(summarizeSources([])).toBe('unknown');
  });

  it('reports cloud only when every attempt was cloud', () => {
    expect(summarizeSources(['cloud', 'cloud'])).toBe('cloud');
    expect(summarizeSources(['cloud', 'unknown'])).toBe('unknown');
  });
});

describe('buildRunReport', () => {
  it('flags an on-device-only request that did not run on-device', () => {
    const report = buildRunReport({
      requestedMode: 'only-on-device',
      attemptSources: ['cloud'],
      ok: true,
      now: () => 1,
    });
    expect(report.source).toBe('cloud');
    expect(report.onDeviceViolation).toBe(true);
    expect(report.finishedAt).toBe(1);
  });

  it('does not flag violations when nothing ran or on-device ran', () => {
    expect(
      buildRunReport({ requestedMode: 'only-on-device', attemptSources: [], ok: false, errorCode: 'x' })
        .onDeviceViolation,
    ).toBe(false);
    expect(
      buildRunReport({ requestedMode: 'only-on-device', attemptSources: ['on-device'], ok: true })
        .onDeviceViolation,
    ).toBe(false);
    expect(
      buildRunReport({ requestedMode: 'prefer-on-device', attemptSources: ['cloud'], ok: true })
        .onDeviceViolation,
    ).toBe(false);
  });

  it('validates stored settings', () => {
    expect(isInferenceModeSetting('only-in-cloud')).toBe(true);
    expect(isInferenceModeSetting('prefer_on_device')).toBe(false);
    expect(isInferenceModeSetting(undefined)).toBe(false);
  });
});
