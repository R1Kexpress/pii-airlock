import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { loadFirebaseConfig, resolveCloudModel, type FirebaseEnv } from './config';
import { setupAppCheck, type AppCheckStatus } from './app-check';

export interface FirebaseHandles {
  app: FirebaseApp;
  ai: AI;
  appCheck: AppCheckStatus;
  cloudModel: string;
}

let cached: FirebaseHandles | undefined;

/**
 * Initializes Firebase once per page. Order: app, App Check, then AI Logic. Call only from an
 * extension page (offscreen document, diagnostics page), never from the service worker.
 */
export function initFirebase(env: FirebaseEnv = import.meta.env): FirebaseHandles {
  if (cached) return cached;
  const app = initializeApp(loadFirebaseConfig(env));
  const appCheck = setupAppCheck(app, env.VITE_APPCHECK_DEBUG_TOKEN);
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  cached = { app, ai, appCheck, cloudModel: resolveCloudModel(env) };
  return cached;
}

export function resetFirebaseForTests(): void {
  cached = undefined;
}
