/**
 * Chat-site DOM selectors live here only (user-verified per site).
 * Do not scatter selectors across content scripts.
 */

export interface ChatSiteConfig {
  id: string;
  hostPattern: RegExp;
  /** Prompt input (textarea, contenteditable root, etc.) */
  inputSelector: string;
  /** Send control */
  sendSelector: string;
}

/** Placeholder until interception slice; matchers must not run on every page blindly. */
export const CHAT_SITES: ChatSiteConfig[] = [];