import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PLACEHOLDER_LENGTH,
  PLACEHOLDER_PATTERN,
  createRehydrationBuffer,
  type PlaceholderLookup,
} from './index';

const VALUES: Record<string, string> = {
  '[SSN_1]': '123-45-6789',
  '[SSN_2]': '987-65-4321',
  '[EMAIL_1]': 'jane@example.com',
  '[EMAIL_2]': 'bob@example.org',
  '[CREDIT_CARD_1]': '4242 4242 4242 4242',
  '[API_KEY_10]': 'sk-live-abcdef',
  '[PHONE_1]': '+1 (555) 010-9999',
  '[IBAN_1]': 'DE89 3704 0044 0532 0130 00',
};

function lookupFrom(map: Record<string, string>): PlaceholderLookup {
  return { lookup: (p) => (Object.hasOwn(map, p) ? map[p] : undefined) };
}

const vault = lookupFrom(VALUES);

/** Independent oracle: one-shot restore, no streaming state. */
function oracle(input: string, map: Record<string, string> = VALUES): string {
  return input.replace(/\[[A-Z]+(?:_[A-Z]+)*_\d+\]/g, (m) =>
    m.length <= MAX_PLACEHOLDER_LENGTH && Object.hasOwn(map, m) ? map[m] : m,
  );
}

function stream(
  chunks: string[],
  lookup: PlaceholderLookup = vault,
  options?: { maxHoldBack?: number },
): string {
  const buf = createRehydrationBuffer(lookup, options);
  let out = '';
  for (const c of chunks) out += buf.push(c);
  out += buf.flush();
  return out;
}

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const wellFormed = (s: string) => !LONE_SURROGATE.test(s);
const chars = (s: string) => Array.from(s);
const oneAt = (s: string) => s.split('');

describe('PLACEHOLDER_PATTERN', () => {
  it.each([
    '[SSN_1]',
    '[EMAIL_22]',
    '[CREDIT_CARD_3]',
    '[API_KEY_10]',
    '[IBAN_1]',
  ])('matches %s', (p) => {
    expect(new RegExp(`^${PLACEHOLDER_PATTERN.source}$`).test(p)).toBe(true);
  });

  it.each([
    '[ssn_1]',
    '[SSN_]',
    '[SSN]',
    '[SSN-1]',
    '[SSN_1 ]',
    '[ SSN_1]',
    '[_1]',
    '[1_1]',
    '[SSN_1_]',
    '[SSN__1]',
    '[]',
    'SSN_1',
    '[SSN_1',
  ])('rejects %s', (p) => {
    expect(new RegExp(`^${PLACEHOLDER_PATTERN.source}$`).test(p)).toBe(false);
  });
});

describe('basic restoration', () => {
  it('restores a placeholder inside a single chunk', () => {
    expect(stream(['My SSN is [SSN_1].'])).toBe('My SSN is 123-45-6789.');
  });

  it('passes plain text through with no hold-back', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('hello world')).toBe('hello world');
    expect(buf.flush()).toBe('');
  });

  it('handles empty input and empty stream', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('')).toBe('');
    expect(buf.flush()).toBe('');
    expect(stream([])).toBe('');
  });

  it('restores multi-word type names and multi-digit counters', () => {
    expect(stream(['[CREDIT_CARD_1] / [API_KEY_10]'])).toBe(
      '4242 4242 4242 4242 / sk-live-abcdef',
    );
  });

  it('restores the same placeholder repeatedly', () => {
    expect(stream(['[SSN_1] and [SSN_1] and [SSN_1]'])).toBe(
      '123-45-6789 and 123-45-6789 and 123-45-6789',
    );
  });

  it('restores to an empty string when the vault value is empty', () => {
    expect(stream(['a[SSN_1]b'], lookupFrom({ '[SSN_1]': '' }))).toBe('ab');
  });

  it('does not rescan restored values for placeholders', () => {
    const map = { '[SSN_1]': '[EMAIL_1]', '[EMAIL_1]': 'x@y.z' };
    expect(stream(['[SSN_1]'], lookupFrom(map))).toBe('[EMAIL_1]');
    expect(stream(oneAt('[SSN_1]'), lookupFrom(map))).toBe('[EMAIL_1]');
  });

  it('inserts restored values containing brackets and regex specials verbatim', () => {
    const map = { '[SSN_1]': '$&$1[x]\\' };
    expect(stream(['<[SSN_1]>'], lookupFrom(map))).toBe('<$&$1[x]\\>');
  });

  it('queries the lookup with the exact placeholder text', () => {
    const lookup = vi.fn((p: string) => (p === '[SSN_1]' ? 'v' : undefined));
    stream(oneAt('a [SSN_1] b [EMAIL_9] c'), { lookup });
    expect(lookup.mock.calls.map((c) => c[0])).toEqual(['[SSN_1]', '[EMAIL_9]']);
  });
});

describe('split placeholders and hold-back', () => {
  it('holds back a trailing "[" and releases the rest', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('Hi [')).toBe('Hi ');
    expect(buf.push('SSN_1] ok')).toBe('123-45-6789 ok');
    expect(buf.flush()).toBe('');
  });

  it.each(['[SS', '[SSN_', '[SSN_1', '[CREDIT_', '[CREDIT_CARD_1'])(
    'holds back trailing partial %s',
    (partial) => {
      const buf = createRehydrationBuffer(vault);
      expect(buf.push(`text ${partial}`)).toBe('text ');
    },
  );

  it('does not emit the value before the closing bracket arrives', () => {
    const buf = createRehydrationBuffer(vault);
    let out = '';
    for (const c of '[SSN_1') {
      out += buf.push(c);
      expect(out).toBe('');
    }
    out += buf.push(']');
    expect(out).toBe('123-45-6789');
  });

  it('never leaks a prefix of the value or placeholder while partial', () => {
    const buf = createRehydrationBuffer(vault);
    const emitted: string[] = [];
    for (const c of 'x [EMAIL_1') emitted.push(buf.push(c));
    expect(emitted.join('')).toBe('x ');
  });

  it('emits chars one-per-chunk correctly', () => {
    const input = 'Contact [EMAIL_1] or [PHONE_1], SSN [SSN_2].';
    expect(stream(oneAt(input))).toBe(oracle(input));
  });

  it('handles every single split offset of a placeholder-rich string', () => {
    const input = 'a[SSN_1]b[EMAIL_2]c[CREDIT_CARD_1]d[API_KEY_10]e';
    for (let i = 0; i <= input.length; i++) {
      expect(stream([input.slice(0, i), input.slice(i)])).toBe(oracle(input));
    }
  });

  it('handles every pair of split offsets (3 chunks)', () => {
    const input = 'x[SSN_1]y[[EMAIL_1]]z[SSN_]w[IBAN_1]';
    for (let i = 0; i <= input.length; i++) {
      for (let j = i; j <= input.length; j++) {
        expect(stream([input.slice(0, i), input.slice(i, j), input.slice(j)])).toBe(
          oracle(input),
        );
      }
    }
  });

  it('is split-invariant for a corpus of tricky inputs at every offset', () => {
    const corpus = [
      '',
      '[',
      ']',
      '[]',
      '[[',
      '[SSN_1]',
      '[SSN_1]]',
      '[[SSN_1]',
      '[[SSN_1]]',
      '[SSN_1][SSN_2]',
      '[SSN_1][',
      '[SSN_1]]SSN_1[',
      '[SSN',
      '[SSN]',
      '[SSN_]',
      '[SSN_1_]',
      '[SSN_1X]',
      '[SSN_X1]',
      '[SSN_1 ]',
      '[ssn_1]',
      '[Ssn_1]',
      '[SSN_9]',
      '[NOPE_1] [SSN_1] [NOPE_2]',
      'see [link](http://x.y) and [SSN_1]',
      '[SSN_1[EMAIL_1]',
      '[SSN_[EMAIL_1]',
      '[[[[SSN_1]',
      'array[0][1] = [EMAIL_1]',
      '日本語[SSN_1]日本語',
      '😀[SSN_1]😀[EMAIL_1]😀',
      '[😀SSN_1]',
      '[SSN_1😀]',
      '\n[SSN_1]\r\n[EMAIL_1]\t',
    ];
    for (const input of corpus) {
      const expected = oracle(input);
      for (let i = 0; i <= input.length; i++) {
        expect(stream([input.slice(0, i), input.slice(i)])).toBe(expected);
      }
      expect(stream(oneAt(input))).toBe(expected);
      expect(stream(chars(input))).toBe(expected);
    }
  });

  it('matches the oracle for seeded random inputs under random chunking', () => {
    let seed = 0xc0ffee;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const atoms = [
      '[', ']', '[SSN_1]', '[EMAIL_2]', 'SSN', '_', '1', '2', 'A', 'x', ' ',
      '\n', '😀', 'é', '[CREDIT_CARD_1]', '[SSN_', '[NOPE_3]', '日',
    ];
    for (let n = 0; n < 400; n++) {
      let input = '';
      const len = Math.floor(rand() * 25);
      for (let k = 0; k < len; k++) input += atoms[Math.floor(rand() * atoms.length)];
      const chunks: string[] = [];
      let pos = 0;
      while (pos < input.length) {
        const size = 1 + Math.floor(rand() * 6);
        chunks.push(input.slice(pos, pos + size));
        pos += size;
      }
      expect(stream(chunks)).toBe(oracle(input));
    }
  });
});

describe('back-to-back placeholders', () => {
  it('restores adjacent placeholders', () => {
    expect(stream(['[SSN_1][SSN_2][EMAIL_1]'])).toBe(
      '123-45-6789987-65-4321jane@example.com',
    );
  });

  it('restores adjacent placeholders when each arrives in its own chunk', () => {
    expect(stream(['[SSN_1]', '[SSN_2]', '[EMAIL_1]'])).toBe(
      '123-45-6789987-65-4321jane@example.com',
    );
  });

  it('restores adjacent placeholders one char per chunk', () => {
    expect(stream(oneAt('[SSN_1][SSN_2][EMAIL_1]'))).toBe(
      '123-45-6789987-65-4321jane@example.com',
    );
  });

  it('closes one placeholder and opens the next within one chunk', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('[SSN_1][EM')).toBe('123-45-6789');
    expect(buf.push('AIL_1]')).toBe('jane@example.com');
  });

  it('separates placeholders by punctuation across chunk edges', () => {
    expect(stream(['[SSN_1],', '[SSN_2];[EMAIL_1', '].'])).toBe(
      '123-45-6789,987-65-4321;jane@example.com.',
    );
  });
});

describe('nested, stray and malformed brackets', () => {
  it('restores a placeholder after a stray opening bracket', () => {
    expect(stream(['[[SSN_1]'])).toBe('[123-45-6789');
    expect(stream(oneAt('[[SSN_1]'))).toBe('[123-45-6789');
  });

  it('keeps a stray closing bracket', () => {
    expect(stream(['[SSN_1]]'])).toBe('123-45-6789]');
    expect(stream(['x]y'])).toBe('x]y');
  });

  it('restores an inner placeholder when an outer one is abandoned', () => {
    expect(stream(['[SSN_1[EMAIL_1]'])).toBe('[SSN_1jane@example.com');
    expect(stream(oneAt('[SSN_1[EMAIL_1]'))).toBe('[SSN_1jane@example.com');
    expect(stream(['[SSN_[EMAIL_1]'])).toBe('[SSN_jane@example.com');
  });

  it('restores inside doubled brackets', () => {
    expect(stream(['[[SSN_1]]'])).toBe('[123-45-6789]');
    expect(stream(oneAt('[[[SSN_1]]]'))).toBe('[[123-45-6789]]');
  });

  it('releases an abandoned partial as soon as it cannot match', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('[SS')).toBe('');
    expect(buf.push('x')).toBe('[SSx');
    expect(buf.flush()).toBe('');
  });

  it('releases "[" held back when the next char rules out a placeholder', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('a[')).toBe('a');
    expect(buf.push(' b')).toBe('[ b');
  });

  it('keeps a trailing lone "]" and bracket pairs untouched', () => {
    expect(stream(['[]', '[', ']'])).toBe('[][]');
  });

  it('passes markdown links and index expressions through unchanged', () => {
    const input = 'see [docs](https://x.y/z) and a[0][i]';
    expect(stream(oneAt(input))).toBe(input);
  });
});

describe('unknown placeholders', () => {
  it('leaves an unknown placeholder unchanged', () => {
    expect(stream(['hi [SSN_99] there'])).toBe('hi [SSN_99] there');
  });

  it('leaves an unknown placeholder unchanged when split across chunks', () => {
    expect(stream(oneAt('hi [SSN_99] there'))).toBe('hi [SSN_99] there');
  });

  it('restores known and keeps unknown in the same stream', () => {
    expect(stream(['[SSN_1] [SSN_77] [EMAIL_1] [FOO_1]'])).toBe(
      '123-45-6789 [SSN_77] jane@example.com [FOO_1]',
    );
  });

  it('does not stall: an unknown placeholder is emitted once complete', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('[SSN_99')).toBe('');
    expect(buf.push(']')).toBe('[SSN_99]');
    expect(buf.push(' next')).toBe(' next');
  });

  it('treats a throwing lookup as unknown', () => {
    const lookup: PlaceholderLookup = {
      lookup: () => {
        throw new Error('vault locked');
      },
    };
    expect(stream(['a [SSN_1] b'], lookup)).toBe('a [SSN_1] b');
  });
});

describe('lookalike text', () => {
  it.each([
    '[ssn_1]',
    '[Ssn_1]',
    '[SSN-1]',
    '[SSN 1]',
    '[SSN_1 ]',
    '[ SSN_1]',
    '[SSN_]',
    '[SSN]',
    '[_1]',
    '[1_1]',
    '[SSN_1_]',
    '[SSN__1]',
    '[SSN_1a]',
    '(SSN_1)',
    '{SSN_1}',
    '<SSN_1>',
    'SSN_1',
    '[SSN_１]',
    '[ＳＳＮ_1]',
    '[SSN_1\u200b]',
    '[SSN\u200b_1]',
  ])('leaves %j unchanged in every chunking', (text) => {
    const input = `before ${text} after`;
    expect(stream([input])).toBe(input);
    expect(stream(oneAt(input))).toBe(input);
    for (let i = 0; i <= input.length; i++) {
      expect(stream([input.slice(0, i), input.slice(i)])).toBe(input);
    }
  });

  it('does not treat a lookalike as a known placeholder even if the vault would match its upper-cased form', () => {
    const lookup = vi.fn(vault.lookup);
    stream(['[ssn_1]'], { lookup });
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('bounded hold-back', () => {
  it('stops holding back after MAX_PLACEHOLDER_LENGTH chars with no closing bracket', () => {
    const buf = createRehydrationBuffer(vault);
    const run = '[' + 'A'.repeat(MAX_PLACEHOLDER_LENGTH * 4);
    let out = '';
    let maxPending = 0;
    for (const c of run) {
      out += buf.push(c);
      maxPending = Math.max(maxPending, run.length - out.length);
    }
    expect(maxPending).toBeLessThanOrEqual(MAX_PLACEHOLDER_LENGTH);
    out += buf.flush();
    expect(out).toBe(run);
  });

  it('emits a very long unterminated run in bulk without holding it all', () => {
    const buf = createRehydrationBuffer(vault);
    const run = '[' + 'SSN_'.repeat(5000);
    const out = buf.push(run);
    expect(run.length - out.length).toBeLessThanOrEqual(MAX_PLACEHOLDER_LENGTH);
    expect(out + buf.flush()).toBe(run);
  });

  it('holds at most the cap even with many repeated "[" opens', () => {
    const buf = createRehydrationBuffer(vault);
    const input = '['.repeat(10_000);
    const out = buf.push(input);
    expect(input.length - out.length).toBeLessThanOrEqual(1);
    expect(out + buf.flush()).toBe(input);
  });

  it('long digit run after a type is bounded and released', () => {
    const input = '[SSN_' + '1'.repeat(500) + ']';
    const buf = createRehydrationBuffer(vault);
    const out = buf.push(input);
    expect(out + buf.flush()).toBe(input);
    expect(input.length - out.length).toBeLessThanOrEqual(MAX_PLACEHOLDER_LENGTH);
  });

  it('does not restore a "placeholder" longer than the maximum, even if known', () => {
    const name = 'A'.repeat(MAX_PLACEHOLDER_LENGTH);
    const token = `[${name}_1]`;
    const lookup = lookupFrom({ [token]: 'secret' });
    expect(stream([token], lookup)).toBe(token);
    expect(stream(oneAt(token), lookup)).toBe(token);
  });

  it('restores a placeholder exactly at the maximum length', () => {
    const name = 'A'.repeat(MAX_PLACEHOLDER_LENGTH - '[_1]'.length);
    const token = `[${name}_1]`;
    expect(token).toHaveLength(MAX_PLACEHOLDER_LENGTH);
    const lookup = lookupFrom({ [token]: 'secret' });
    expect(stream([token], lookup)).toBe('secret');
    expect(stream(oneAt(token), lookup)).toBe('secret');
  });

  it('resumes normal restoration right after an over-long abandoned run', () => {
    const junk = '[' + 'B'.repeat(MAX_PLACEHOLDER_LENGTH * 2);
    expect(stream(oneAt(`${junk} [SSN_1]`))).toBe(`${junk} 123-45-6789`);
  });

  it('honours a custom maxHoldBack', () => {
    const buf = createRehydrationBuffer(vault, { maxHoldBack: 8 });
    const out = buf.push('[AAAAAAAAAAAAAAAA');
    expect('[AAAAAAAAAAAAAAAA'.length - out.length).toBeLessThanOrEqual(8);
    expect(out + buf.flush()).toBe('[AAAAAAAAAAAAAAAA');
  });

  it('exposes a numeric pendingLength that never exceeds the cap', () => {
    const buf = createRehydrationBuffer(vault);
    for (const c of '[' + 'Z'.repeat(300)) {
      buf.push(c);
      expect(buf.pendingLength).toBeLessThanOrEqual(MAX_PLACEHOLDER_LENGTH);
    }
    buf.flush();
    expect(buf.pendingLength).toBe(0);
  });
});

describe('unicode', () => {
  it('passes multibyte text through unchanged', () => {
    const input = '日本語のテキスト, café, naïve, Ωmega';
    expect(stream(oneAt(input))).toBe(input);
  });

  it('restores placeholders surrounded by CJK and emoji', () => {
    expect(stream(oneAt('名前は[EMAIL_1]です😀'))).toBe('名前はjane@example.comです😀');
  });

  it('never emits a lone surrogate when an emoji is split across chunks', () => {
    const emoji = '😀';
    const buf = createRehydrationBuffer(vault);
    const first = buf.push('hi ' + emoji[0]);
    expect(first).toBe('hi ');
    const second = buf.push(emoji[1] + '!');
    expect(second).toBe(emoji + '!');
    expect(wellFormed(first)).toBe(true);
    expect(wellFormed(second)).toBe(true);
  });

  it('every emitted piece is well-formed for UTF-16 code-unit chunking', () => {
    const input = 'a😀[SSN_1]😀😀b𝒳[EMAIL_1]';
    const buf = createRehydrationBuffer(vault);
    let out = '';
    for (const c of oneAt(input)) {
      const piece = buf.push(c);
      expect(wellFormed(piece)).toBe(true);
      out += piece;
    }
    out += buf.flush();
    expect(out).toBe(oracle(input));
  });

  it('flushes a dangling lone high surrogate verbatim at end of stream', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('x\ud83d')).toBe('x');
    expect(buf.flush()).toBe('\ud83d');
  });

  it('does not treat non-ASCII lookalike letters as placeholder types', () => {
    const input = '[ÅSSN_1][SSN_1]';
    expect(stream(oneAt(input))).toBe('[ÅSSN_1]123-45-6789');
  });

  it('keeps combining characters adjacent to a restored value untouched', () => {
    expect(stream(oneAt('e\u0301[SSN_1]\u0301'))).toBe('e\u0301123-45-6789\u0301');
  });
});

describe('empty chunks', () => {
  it('ignores empty chunks between placeholder fragments', () => {
    const buf = createRehydrationBuffer(vault);
    let out = '';
    for (const c of ['', '[', '', 'SSN', '', '_1', '', ']', '']) out += buf.push(c);
    out += buf.flush();
    expect(out).toBe('123-45-6789');
  });

  it('returns an empty string for an empty chunk while holding a partial', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('[SS')).toBe('');
    expect(buf.push('')).toBe('');
    expect(buf.pendingLength).toBe(3);
    expect(buf.flush()).toBe('[SS');
  });

  it('does not release a held partial just because empty chunks keep arriving', () => {
    const buf = createRehydrationBuffer(vault);
    buf.push('[SSN_');
    for (let i = 0; i < 50; i++) expect(buf.push('')).toBe('');
    expect(buf.push('1]')).toBe('123-45-6789');
  });
});

describe('flush', () => {
  it('flush mid-partial returns the partial unchanged', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('value [SSN_')).toBe('value ');
    expect(buf.flush()).toBe('[SSN_');
  });

  it.each(['[', '[S', '[SSN', '[SSN_', '[SSN_1', '[SSN_12', '[CREDIT_CARD_'])(
    'flush after partial %s emits it verbatim',
    (partial) => {
      const buf = createRehydrationBuffer(vault);
      const out = buf.push('a' + partial);
      expect(out + buf.flush()).toBe('a' + partial);
    },
  );

  it('flush with nothing pending returns an empty string and is idempotent', () => {
    const buf = createRehydrationBuffer(vault);
    buf.push('done [SSN_1]');
    expect(buf.flush()).toBe('');
    expect(buf.flush()).toBe('');
  });

  it('flush does not restore an unclosed placeholder', () => {
    const buf = createRehydrationBuffer(vault);
    buf.push('[SSN_1');
    expect(buf.flush()).toBe('[SSN_1');
  });

  it('resets state so the buffer can be reused for the next stream', () => {
    const buf = createRehydrationBuffer(vault);
    buf.push('first [SSN_');
    expect(buf.flush()).toBe('[SSN_');
    expect(buf.push('1] is not a placeholder')).toBe('1] is not a placeholder');
    expect(buf.push('[SSN_1]')).toBe('123-45-6789');
  });

  it('flush right after a complete placeholder has nothing left over', () => {
    const buf = createRehydrationBuffer(vault);
    expect(buf.push('[SSN_1]')).toBe('123-45-6789');
    expect(buf.flush()).toBe('');
  });
});

describe('independent instances', () => {
  it('keeps state separate between buffers', () => {
    const a = createRehydrationBuffer(vault);
    const b = createRehydrationBuffer(vault);
    expect(a.push('[SSN_')).toBe('');
    expect(b.push('[EMAIL_')).toBe('');
    expect(a.push('1]')).toBe('123-45-6789');
    expect(b.push('2]')).toBe('bob@example.org');
  });

  it('reads vault values at lookup time, not construction time', () => {
    const map: Record<string, string> = {};
    const buf = createRehydrationBuffer(lookupFrom(map));
    expect(buf.push('[SSN_1')).toBe('');
    map['[SSN_1]'] = 'late-value';
    expect(buf.push(']')).toBe('late-value');
  });
});

describe('privacy', () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map(
    (m) => vi.spyOn(console, m).mockImplementation(() => undefined),
  );

  afterEach(() => {
    spies.forEach((s) => s.mockClear());
  });

  it('never writes to the console, even for unknown or throwing lookups', () => {
    const lookup: PlaceholderLookup = {
      lookup: (p) => {
        if (p === '[SSN_3]') throw new Error('boom 123-45-6789');
        return vault.lookup(p);
      },
    };
    stream(oneAt('x [SSN_1] [SSN_3] [NOPE_1] [AAAA' + 'A'.repeat(100)), lookup);
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it('does not touch web storage or the extension storage API', () => {
    const touched: string[] = [];
    const trap = (name: string) =>
      new Proxy(
        {},
        {
          get(_t, prop) {
            touched.push(`${name}.${String(prop)}`);
            return () => undefined;
          },
        },
      );
    vi.stubGlobal('localStorage', trap('localStorage'));
    vi.stubGlobal('sessionStorage', trap('sessionStorage'));
    vi.stubGlobal('indexedDB', trap('indexedDB'));
    vi.stubGlobal('chrome', { storage: trap('chrome.storage') });
    try {
      stream(oneAt('a [SSN_1] b [SSN_'), vault);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(touched).toEqual([]);
  });

  it('exposes no readable text on the buffer object', () => {
    const buf = createRehydrationBuffer(vault);
    buf.push('secret [SSN_');
    const surface = Object.keys(buf).sort();
    expect(surface).toEqual(['flush', 'pendingLength', 'push']);
    for (const key of surface) {
      const v = (buf as unknown as Record<string, unknown>)[key];
      expect(typeof v === 'function' || typeof v === 'number').toBe(true);
    }
  });

  it('clears held text after flush', () => {
    const buf = createRehydrationBuffer(vault);
    buf.push('[SSN_');
    buf.flush();
    expect(buf.pendingLength).toBe(0);
  });
});
