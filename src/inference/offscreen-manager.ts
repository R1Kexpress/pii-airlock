export const OFFSCREEN_DOCUMENT_PATH = 'src/inference/offscreen.html';

/**
 * TODO(verify): no documented offscreen `reasons` value fits "run AI inference" (API notes
 * section 9). TESTING is the only honest choice for an unpacked hackathon build; Chrome may
 * review the justification string. Re-pick before any Web Store submission.
 */
export const OFFSCREEN_REASON = 'TESTING' as const;
export const OFFSCREEN_JUSTIFICATION =
  'Hosts on-device Prompt API / Firebase AI Logic inference, which needs a DOM context unavailable in service workers.';

let creating: Promise<void> | undefined;

/**
 * Creates the single offscreen inference document if it does not exist. `hasDocument` and
 * `createDocument` are present in @types/chrome (offscreen namespace) but their exact names are
 * not spelled out in the API notes: TODO(verify) against developer.chrome.com offscreen docs.
 */
export async function ensureOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason[OFFSCREEN_REASON]],
      justification: OFFSCREEN_JUSTIFICATION,
    })
    .finally(() => {
      creating = undefined;
    });
  await creating;
}
