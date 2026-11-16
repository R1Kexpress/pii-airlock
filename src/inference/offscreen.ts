/**
 * Remote Config, Firestore telemetry, and Firebase AI Logic run here (offscreen document with a DOM),
 * not in the MV3 service worker. See firebase-hybrid-api-notes.md (C5) — only `chrome.runtime`
 * is available inside this document.
 */
import { registerInferenceHost } from './host';

registerInferenceHost();
