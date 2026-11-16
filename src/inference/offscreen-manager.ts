export const OFFSCREEN_DOCUMENT_PATH = 'src/inference/offscreen.html';

/**
 * Chrome blocks `TESTING` unless the browser was launched with `--offscreen-document-testing`.
 * Use `DOM_PARSER` for a hidden DOM document (VERIFIED-DOC: offscreen `Reason` enum). No single
 * reason clearly means “AI inference”; pick the closest for unpacked dev and revisit for store.
 */
export const OFFSCREEN_REASON = 'DOM_PARSER' as const;
export const OFFSCREEN_JUSTIFICATION =
  'Hosts Firebase AI Logic and Remote Config in a hidden DOM context unavailable in service workers.';

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
