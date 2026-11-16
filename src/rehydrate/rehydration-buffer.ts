import {
  COMPLETE_AT_START,
  MAX_PLACEHOLDER_LENGTH,
  PARTIAL_PREFIX,
  type PlaceholderLookup,
} from './placeholder';

export interface RehydrationBufferOptions {
  /** Max chars held back awaiting a placeholder's `]`. Clamped to >= 2. */
  maxHoldBack?: number;
}

export interface RehydrationBuffer {
  /** Feed a streamed chunk; returns text that is safe to emit now. */
  push(chunk: string): string;
  /** End of stream: returns any held-back text verbatim and resets state. */
  flush(): string;
  /** Number of chars currently held back (never the text itself). */
  readonly pendingLength: number;
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;

/**
 * Stateful stream restorer. Holds only a trailing run that could still grow
 * into a placeholder (or half a surrogate pair); everything else is emitted
 * immediately. Text is kept in memory only for the life of the instance and is
 * never logged or persisted.
 */
export function createRehydrationBuffer(
  vault: PlaceholderLookup,
  options: RehydrationBufferOptions = {},
): RehydrationBuffer {
  const cap = Math.max(
    2,
    Math.min(options.maxHoldBack ?? MAX_PLACEHOLDER_LENGTH, MAX_PLACEHOLDER_LENGTH),
  );
  let pending = '';

  const restore = (placeholder: string): string => {
    try {
      return vault.lookup(placeholder) ?? placeholder;
    } catch {
      return placeholder;
    }
  };

  const drain = (): string => {
    let out = '';
    let pos = 0;
    while (pos < pending.length) {
      const open = pending.indexOf('[', pos);
      if (open === -1) {
        out += pending.slice(pos);
        pos = pending.length;
        break;
      }
      out += pending.slice(pos, open);
      const rest = pending.slice(open, open + cap + 1);
      const complete = COMPLETE_AT_START.exec(rest);
      if (complete && complete[0].length <= cap) {
        out += restore(complete[0]);
        pos = open + complete[0].length;
        continue;
      }
      const tail = pending.slice(open);
      if (tail.length <= cap && PARTIAL_PREFIX.test(tail)) {
        pos = open;
        break;
      }
      out += '[';
      pos = open + 1;
    }
    pending = pending.slice(pos);

    if (pending === '' && out !== '' && isHighSurrogate(out.charCodeAt(out.length - 1))) {
      pending = out.slice(-1);
      out = out.slice(0, -1);
    }
    return out;
  };

  return {
    push(chunk: string): string {
      if (chunk === '') return '';
      pending += chunk;
      return drain();
    },
    flush(): string {
      const rest = pending;
      pending = '';
      return rest;
    },
    get pendingLength() {
      return pending.length;
    },
  };
}
