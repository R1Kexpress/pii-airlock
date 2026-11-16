/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** "true" to let the SDK generate a debug token, or a registered token string. Debug builds only. */
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_AI_CLOUD_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
