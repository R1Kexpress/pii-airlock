import type { FirebaseApp } from 'firebase/app';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeAppCheck = vi.fn();
const customProviderCtor = vi.fn();

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: (...args: unknown[]) => initializeAppCheck(...args),
  CustomProvider: class {
    constructor(options: unknown) {
      customProviderCtor(options);
    }
  },
}));

import { createAppCheckProvider, resolveDebugToken, setupAppCheck } from './app-check';

type DebugGlobal = { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean };
const fakeApp = {} as FirebaseApp;

beforeEach(() => {
  delete (globalThis as DebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN;
  initializeAppCheck.mockReset();
  customProviderCtor.mockReset();
});

afterEach(() => {
  delete (globalThis as DebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN;
});

describe('resolveDebugToken', () => {
  it('interprets env values', () => {
    expect(resolveDebugToken(undefined)).toBeUndefined();
    expect(resolveDebugToken('  ')).toBeUndefined();
    expect(resolveDebugToken('true')).toBe(true);
    expect(resolveDebugToken(' TRUE ')).toBe(true);
    expect(resolveDebugToken('abc-123')).toBe('abc-123');
  });
});

describe('setupAppCheck', () => {
  it('stays disabled without a debug token', () => {
    expect(setupAppCheck(fakeApp, undefined)).toBe('disabled');
    expect(initializeAppCheck).not.toHaveBeenCalled();
    expect((globalThis as DebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });

  it('sets the debug token global before initializeAppCheck runs', () => {
    let seenAtInit: unknown;
    initializeAppCheck.mockImplementation(() => {
      seenAtInit = (globalThis as DebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN;
    });
    expect(setupAppCheck(fakeApp, 'registered-token')).toBe('debug');
    expect(seenAtInit).toBe('registered-token');
    expect(initializeAppCheck).toHaveBeenCalledWith(
      fakeApp,
      expect.objectContaining({ isTokenAutoRefreshEnabled: true }),
    );
  });

  it('passes true through so the SDK generates a token', () => {
    setupAppCheck(fakeApp, 'true');
    expect((globalThis as DebugGlobal).FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
  });
});

describe('createAppCheckProvider (swap point)', () => {
  it('stub getToken rejects: it must never be relied on for a real token', async () => {
    createAppCheckProvider();
    const { getToken } = customProviderCtor.mock.calls[0][0] as { getToken: () => Promise<unknown> };
    await expect(getToken()).rejects.toThrow('No production App Check provider configured');
  });
});
