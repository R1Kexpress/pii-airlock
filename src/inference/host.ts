import { initFirebase } from '../firebase/init';
import { detectWithModel, DetectWithModelError } from './detect-with-model';
import { checkOnDeviceStatus } from './hybrid-model';
import {
  type DiagnosticsResponse,
  type HostDiagnostics,
  type ModelDetectResponse,
  isHostDetectRequest,
  isHostDiagnosticsRequest,
} from './messages';

export async function collectDiagnostics(
  context: HostDiagnostics['context'],
): Promise<HostDiagnostics> {
  const onDevice = await checkOnDeviceStatus();
  let appCheck: HostDiagnostics['appCheck'] = 'init-failed';
  try {
    appCheck = initFirebase().appCheck;
  } catch {
    // Config problems surface through detection errors; diagnostics just report the state.
  }
  return { ...onDevice, appCheck, context };
}

async function handleDetect(text: string, mode: Parameters<typeof detectWithModel>[1]) {
  try {
    const { spans, run } = await detectWithModel(text, mode);
    return { ok: true, spans, run } satisfies ModelDetectResponse;
  } catch (error) {
    if (error instanceof DetectWithModelError) {
      return { ok: false, errorCode: error.code, run: error.run } satisfies ModelDetectResponse;
    }
    return { ok: false, errorCode: 'internal-error' } satisfies ModelDetectResponse;
  }
}

/**
 * Registers the host's message listener. Runs in the offscreen document, where only
 * `chrome.runtime` is available (VERIFIED-DOC), so it has no storage access: callers pass the
 * mode in and persist results themselves.
 */
export function registerInferenceHost(): void {
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || sender.tab) return false;

    if (isHostDetectRequest(message)) {
      void handleDetect(message.text, message.mode).then(sendResponse);
      return true;
    }
    if (isHostDiagnosticsRequest(message)) {
      collectDiagnostics('offscreen-document').then(
        (diagnostics) => sendResponse({ ok: true, diagnostics } satisfies DiagnosticsResponse),
        () => sendResponse({ ok: false, errorCode: 'internal-error' } satisfies DiagnosticsResponse),
      );
      return true;
    }
    return false;
  });
}
