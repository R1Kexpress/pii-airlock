import {
  getGenerativeModel,
  type AI,
  type GenerativeModel,
  type HybridParams,
  type LanguageModelCreateOptions,
} from 'firebase/ai';
import { MODEL_SYSTEM_PROMPT } from '../detection/model/prompt';
import type { ModelClient } from '../detection/model/detect';
import { toFirebaseMode } from './firebase-mapping';
import type { InferenceModeSetting } from './modes';
import { ON_DEVICE_RESPONSE_CONSTRAINT, buildCloudResponseSchema } from './schema';

export const ON_DEVICE_CREATE_OPTIONS: LanguageModelCreateOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
  initialPrompts: [{ role: 'system', content: [{ type: 'text', value: MODEL_SYSTEM_PROMPT }] }],
};

/**
 * Both sides are configured separately (API notes section 3 item 3 and section 5): the SDK does
 * not apply inCloudParams.systemInstruction/generationConfig on-device.
 */
export function buildHybridParams(setting: InferenceModeSetting, cloudModel: string): HybridParams {
  return {
    mode: toFirebaseMode(setting),
    onDeviceParams: {
      createOptions: ON_DEVICE_CREATE_OPTIONS,
      promptOptions: { responseConstraint: ON_DEVICE_RESPONSE_CONSTRAINT },
    },
    inCloudParams: {
      model: cloudModel,
      systemInstruction: MODEL_SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: buildCloudResponseSchema(),
      },
    },
  };
}

/** Static message only: never includes prompt data. */
export class OnDeviceUnavailableError extends Error {
  readonly code: string;
  constructor(reason: string) {
    super('On-device model is not available in this context');
    this.name = 'OnDeviceUnavailableError';
    this.code = `on-device-unavailable:${reason}`;
  }
}

interface LanguageModelGlobal {
  availability(options?: object): Promise<string>;
}

function getLanguageModel(): LanguageModelGlobal | undefined {
  return (globalThis as { LanguageModel?: LanguageModelGlobal }).LanguageModel;
}

export interface OnDeviceStatus {
  hasLanguageModel: boolean;
  /** Chrome availability string (unavailable/downloadable/downloading/available) or an error marker. */
  availability: string;
}

/**
 * `LanguageModel.availability()` is VERIFIED-DOC (Chrome Prompt API docs); the SDK itself calls it
 * with the same createOptions. TODO(verify): behavior of passing `initialPrompts` to availability().
 */
export async function checkOnDeviceStatus(): Promise<OnDeviceStatus> {
  const languageModel = getLanguageModel();
  if (!languageModel) return { hasLanguageModel: false, availability: 'missing' };
  try {
    return {
      hasLanguageModel: true,
      availability: await languageModel.availability(ON_DEVICE_CREATE_OPTIONS),
    };
  } catch {
    return { hasLanguageModel: true, availability: 'error' };
  }
}

/**
 * The SDK silently routes ONLY_ON_DEVICE to the cloud when `LanguageModel` does not exist in the
 * current context (VERIFIED-SDK source, notes section 3 item 1). Fail before any text is sent.
 */
export async function assertOnDeviceReady(
  check: () => Promise<OnDeviceStatus> = checkOnDeviceStatus,
): Promise<void> {
  const status = await check();
  if (!status.hasLanguageModel) throw new OnDeviceUnavailableError('language-model-missing');
  if (status.availability !== 'available') {
    throw new OnDeviceUnavailableError(status.availability);
  }
}

export interface HybridClientDeps {
  ai: AI;
  cloudModel: string;
  setting: InferenceModeSetting;
  createModel?: (ai: AI, params: HybridParams) => GenerativeModel;
  checkOnDevice?: () => Promise<OnDeviceStatus>;
}

export function createHybridClient(deps: HybridClientDeps): ModelClient {
  const create = deps.createModel ?? getGenerativeModel;
  let model: GenerativeModel | undefined;

  return {
    async generate(prompt) {
      if (deps.setting === 'only-on-device') await assertOnDeviceReady(deps.checkOnDevice);
      model ??= create(deps.ai, buildHybridParams(deps.setting, deps.cloudModel));
      const { response } = await model.generateContent(prompt);
      return { text: response.text(), inferenceSource: response.inferenceSource };
    },
  };
}

/**
 * Must be called from a user gesture in a visible extension page (VERIFIED-DOC: download needs
 * user activation). Uses prefer-on-device so the call itself never throws for lack of a model.
 */
export async function warmUpOnDeviceModel(
  ai: AI,
  cloudModel: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  const model = getGenerativeModel(ai, buildHybridParams('prefer-on-device', cloudModel));
  await model.initializeDeviceModel(onProgress);
}
