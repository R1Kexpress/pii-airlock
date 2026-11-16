import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
  doc,
  getFirestore,
  increment,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { PII_TYPES, type PiiType } from '../detection/types';
import type { RunSource } from '../inference/modes';

export const METRICS_COLLECTION = 'airlock_metrics';

const CATEGORY_FIELD_PREFIX = 'category_';
const MODE_FIELD_ON_DEVICE = 'mode_on_device';
const MODE_FIELD_IN_CLOUD = 'mode_in_cloud';

let firestoreHandle: Firestore | undefined;
let authHandle: Auth | undefined;
let authReady: Promise<void> | undefined;

function categoryField(type: PiiType): string {
  return `${CATEGORY_FIELD_PREFIX}${type}`;
}

export const ALLOWED_METRIC_FIELDS = [
  ...PII_TYPES.map((t) => categoryField(t)),
  MODE_FIELD_ON_DEVICE,
  MODE_FIELD_IN_CLOUD,
] as const;

export function utcDayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function resetTelemetryClientsForTests(): void {
  firestoreHandle = undefined;
  authHandle = undefined;
  authReady = undefined;
}

function getOrCreateFirestore(app: FirebaseApp): Firestore {
  if (!firestoreHandle) firestoreHandle = getFirestore(app);
  return firestoreHandle;
}

function getOrCreateAuth(app: FirebaseApp): Auth {
  if (!authHandle) authHandle = getAuth(app);
  return authHandle;
}

/** Anonymous Auth for Firestore rules; no user id is written to metrics documents. */
export async function ensureAnonymousAuth(app: FirebaseApp): Promise<void> {
  if (authReady) return authReady;
  const auth = getOrCreateAuth(app);
  authReady = (async () => {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  })();
  return authReady;
}

export interface TelemetryBatch {
  categories: Partial<Record<PiiType, number>>;
  mode?: RunSource;
  dayKey?: string;
}

export function buildMetricUpdate(batch: TelemetryBatch): Record<string, ReturnType<typeof increment>> {
  const payload: Record<string, ReturnType<typeof increment>> = {};
  for (const t of PII_TYPES) {
    const n = batch.categories[t];
    if (typeof n === 'number' && n > 0) {
      payload[categoryField(t)] = increment(n);
    }
  }
  if (batch.mode === 'on-device') {
    payload[MODE_FIELD_ON_DEVICE] = increment(1);
  } else if (batch.mode === 'cloud') {
    payload[MODE_FIELD_IN_CLOUD] = increment(1);
  }
  return payload;
}

// TODO(verify): Firestore WebChannel / fetch behavior from an MV3 offscreen document origin.
export async function submitAnonymizedMetrics(
  app: FirebaseApp,
  batch: TelemetryBatch,
): Promise<void> {
  if (Object.keys(buildMetricUpdate(batch)).length === 0) return;
  await ensureAnonymousAuth(app);
  const db = getOrCreateFirestore(app);
  const day = batch.dayKey ?? utcDayKey();
  const ref = doc(db, METRICS_COLLECTION, day);
  await setDoc(ref, buildMetricUpdate(batch), { merge: true });
}