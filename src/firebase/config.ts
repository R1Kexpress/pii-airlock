import type { FirebaseOptions } from 'firebase/app';

export interface FirebaseEnv {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_APPCHECK_DEBUG_TOKEN?: string;
  VITE_AI_CLOUD_MODEL?: string;
}

/** Default hybrid cloud model since firebase 13.0.0 (API notes, section 1). */
export const DEFAULT_CLOUD_MODEL = 'gemini-3.5-flash-lite';

const REQUIRED = [
  ['VITE_FIREBASE_API_KEY', 'apiKey'],
  ['VITE_FIREBASE_PROJECT_ID', 'projectId'],
  ['VITE_FIREBASE_APP_ID', 'appId'],
] as const;

const OPTIONAL = [
  ['VITE_FIREBASE_AUTH_DOMAIN', 'authDomain'],
  ['VITE_FIREBASE_STORAGE_BUCKET', 'storageBucket'],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId'],
] as const;

export class FirebaseConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing Firebase build-time env vars: ${missing.join(', ')}. See .env.example.`);
    this.name = 'FirebaseConfigError';
  }
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Builds FirebaseOptions from build-time env. Error messages name variables, never values. */
export function loadFirebaseConfig(env: FirebaseEnv): FirebaseOptions {
  const options: FirebaseOptions = {};
  const missing: string[] = [];

  for (const [envKey, optionKey] of REQUIRED) {
    const value = clean(env[envKey]);
    if (value) options[optionKey] = value;
    else missing.push(envKey);
  }
  if (missing.length > 0) throw new FirebaseConfigError(missing);

  for (const [envKey, optionKey] of OPTIONAL) {
    const value = clean(env[envKey]);
    if (value) options[optionKey] = value;
  }
  return options;
}

export function resolveCloudModel(env: FirebaseEnv): string {
  return clean(env.VITE_AI_CLOUD_MODEL) ?? DEFAULT_CLOUD_MODEL;
}
