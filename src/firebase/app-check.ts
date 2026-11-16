import type { FirebaseApp } from 'firebase/app';
import {
  CustomProvider,
  initializeAppCheck,
  type AppCheckToken,
} from 'firebase/app-check';

export type AppCheckStatus = 'debug' | 'disabled';

/** "true" asks the SDK to generate a debug token; any other non-empty string is used as the token. */
export function resolveDebugToken(raw: string | undefined): string | true | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  return value.toLowerCase() === 'true' ? true : value;
}

/**
 * TODO(verify): swap point for the App Check provider. Using `CustomProvider` as a stub is the
 * author's inference (API notes section 7), not documented: it relies on the SDK bypassing
 * `provider.getToken()` when FIREBASE_APPCHECK_DEBUG_TOKEN is set. ReCaptcha*Provider is avoided
 * because it injects a remote script that the MV3 extension_pages CSP blocks. No production
 * provider for MV3 extensions is verified; replace this function when one is chosen.
 */
export function createAppCheckProvider(): CustomProvider {
  return new CustomProvider({
    getToken: async (): Promise<AppCheckToken> => {
      throw new Error('No production App Check provider configured');
    },
  });
}

/**
 * Sets FIREBASE_APPCHECK_DEBUG_TOKEN (VERIFIED-DOC: must be set before initializeAppCheck, in a
 * bundled module, not inline) and then initializes App Check. Without a debug token App Check is
 * left uninitialized and requests will fail if enforcement is on.
 */
export function setupAppCheck(app: FirebaseApp, rawDebugToken: string | undefined): AppCheckStatus {
  const debugToken = resolveDebugToken(rawDebugToken);
  if (debugToken === undefined) return 'disabled';

  (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    debugToken;
  initializeAppCheck(app, {
    provider: createAppCheckProvider(),
    isTokenAutoRefreshEnabled: true,
  });
  return 'debug';
}
