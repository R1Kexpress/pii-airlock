/**
 * Placeholder grammar: `[TYPE_N]` where TYPE is one or more upper-case ASCII
 * words joined by `_` (e.g. `SSN`, `CREDIT_CARD`) and N is a decimal counter.
 * Owned by the rehydration module so it has no dependency on the vault.
 */
export const PLACEHOLDER_PATTERN = /\[[A-Z]+(?:_[A-Z]+)*_[0-9]+\]/;

/**
 * Longest text (in UTF-16 units, brackets included) treated as a placeholder.
 * Also the upper bound on how much text the streaming buffer ever holds back.
 */
export const MAX_PLACEHOLDER_LENGTH = 64;

/** Anchored: the text starting at a `[` is a complete placeholder. */
export const COMPLETE_AT_START = new RegExp(`^${PLACEHOLDER_PATTERN.source}`);

/** Anchored: the whole text is a proper prefix of (or equal to) a placeholder, minus the `]`. */
export const PARTIAL_PREFIX = /^\[(?:[A-Z]+(?:_[A-Z]+)*(?:_[0-9]*)?)?$/;

/** Minimal vault contract; satisfied by the real vault when it lands. */
export interface PlaceholderLookup {
  lookup(placeholder: string): string | undefined;
}
