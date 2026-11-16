import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLOUD_MODEL,
  FirebaseConfigError,
  loadFirebaseConfig,
  resolveCloudModel,
} from './config';

describe('loadFirebaseConfig', () => {
  it('builds options from env, trimming values', () => {
    expect(
      loadFirebaseConfig({
        VITE_FIREBASE_API_KEY: ' key ',
        VITE_FIREBASE_PROJECT_ID: 'proj',
        VITE_FIREBASE_APP_ID: 'app',
        VITE_FIREBASE_AUTH_DOMAIN: 'proj.firebaseapp.com',
      }),
    ).toEqual({
      apiKey: 'key',
      projectId: 'proj',
      appId: 'app',
      authDomain: 'proj.firebaseapp.com',
    });
  });

  it('names missing variables without echoing any values', () => {
    try {
      loadFirebaseConfig({ VITE_FIREBASE_API_KEY: 'super-secret-key', VITE_FIREBASE_PROJECT_ID: '  ' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(FirebaseConfigError);
      expect((error as FirebaseConfigError).missing).toEqual([
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_APP_ID',
      ]);
      expect((error as Error).message).not.toContain('super-secret-key');
    }
  });

  it('resolves the cloud model with a default', () => {
    expect(resolveCloudModel({})).toBe(DEFAULT_CLOUD_MODEL);
    expect(resolveCloudModel({ VITE_AI_CLOUD_MODEL: ' custom ' })).toBe('custom');
  });
});
