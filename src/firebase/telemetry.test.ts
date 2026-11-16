import type { FirebaseApp } from 'firebase/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDoc = vi.fn();
const signInAnonymously = vi.fn();
const getFirestore = vi.fn();
const getAuth = vi.fn();
const doc = vi.fn();

vi.mock('firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => getFirestore(...args),
  doc: (...args: unknown[]) => doc(...args),
  increment: (n: number) => ({ __increment: n }),
  setDoc: (...args: unknown[]) => setDoc(...args),
}));

vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => getAuth(...args),
  signInAnonymously: (...args: unknown[]) => signInAnonymously(...args),
}));

import {
  ALLOWED_METRIC_FIELDS,
  buildMetricUpdate,
  resetTelemetryClientsForTests,
  submitAnonymizedMetrics,
  utcDayKey,
} from './telemetry';

const fakeApp = {} as FirebaseApp;

beforeEach(() => {
  resetTelemetryClientsForTests();
  getFirestore.mockReturnValue({});
  getAuth.mockReturnValue({ currentUser: { uid: 'anon' } });
  doc.mockReturnValue({ path: 'airlock_metrics/2026-01-01' });
  setDoc.mockResolvedValue(undefined);
  signInAnonymously.mockResolvedValue(undefined);
});

describe('buildMetricUpdate', () => {
  it('only includes positive category counts and known mode fields', () => {
    const payload = buildMetricUpdate({
      categories: { email: 2, ssn: 0, phone: 1 },
      mode: 'on-device',
    });
    expect(payload.category_email).toEqual({ __increment: 2 });
    expect(payload.category_phone).toEqual({ __increment: 1 });
    expect(payload.category_ssn).toBeUndefined();
    expect(payload.mode_on_device).toEqual({ __increment: 1 });
    expect(ALLOWED_METRIC_FIELDS.length).toBeGreaterThan(0);
  });
});

describe('submitAnonymizedMetrics', () => {
  it('writes merge increments without prompt fields', async () => {
    await submitAnonymizedMetrics(fakeApp, {
      categories: { api_key: 1 },
      mode: 'cloud',
      dayKey: '2026-11-16',
    });
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'airlock_metrics/2026-01-01' },
      expect.objectContaining({
        category_api_key: { __increment: 1 },
        mode_in_cloud: { __increment: 1 },
      }),
      { merge: true },
    );
    const payload = setDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(payload)).not.toContain('text');
    expect(Object.keys(payload)).not.toContain('prompt');
  });
});

describe('utcDayKey', () => {
  it('formats UTC date', () => {
    expect(utcDayKey(Date.UTC(2026, 10, 16, 12))).toBe('2026-11-16');
  });
});