# PII Airlock — specification

Chrome MV3 extension for the #BuildHybridAI 2026 hackathon: detect sensitive data in chat prompts, replace with placeholders before send, restore in streamed responses. Hybrid inference via **Firebase AI Logic** (Gemini Nano on-device when available, cloud fallback) — wired in a later slice; **do not guess Firebase API names** (see [official docs](https://firebase.google.com/docs/ai-logic)); flag unverified imports/methods in code reviews.

## Working rules (non-negotiable)

1. **Firebase**: Never guess API names or SDK methods. Read official documentation. Mark anything unverified in PRs/issues for human verification.
2. **Selectors**: Chat-site DOM selectors live only in `src/config/chat-sites.ts`.
3. **Privacy**: Never persist placeholder mappings to disk nor **log raw prompt text** (including `console.log` of user input).
4. **Tests**: Write tests **before** merge/dedupe logic and **before** the streaming rehydration buffer (adversarial tests first for rehydration).
5. **Slices**: Vertical slices, one PR theme at a time; small commits per working piece.
6. **Context**: Keep `SPEC.md` and repo README current; `.cursorignore` excludes `node_modules`, `dist`, lockfiles, large assets.

## Build order (high level)

1. Firebase AI Logic hybrid call + mode indicator (user verifies APIs)
2. Labeled test set + Nano quality (user)
3. **Regex layer + merge/dedupe** ← this slice
4. Chat-site interception (user supplies selectors)
5. Placeholder vault + rewriting
6. Streaming rehydration buffer (tests first)
7. Preview UI, popup, options, ledger
8. Remote Config, Firestore, App Check
9. Polish; optional second site
10. Demo video and Devpost submission (user)

## Detection model

- **Regex detectors** (shipped): SSN, credit card (Luhn), email, phone, API key heuristics, IBAN (MOD-97).
- Each hit is a `DetectionSpan`: `{ type, start, end, confidence, source }` with `source: 'regex' | 'model'`.
- **Merge**: `mergeDetections(regexSpans, modelSpans)` resolves same-type overlaps (confidence, then model over regex); different types may coexist on overlapping text until rewriting slice coalesces behavior.

## Extension architecture (MV3)

- **Service worker**: message hub; detection orchestration (no prompt logging).
- **Content script**: future prompt interception; pings background on load.
- **Popup**: connection status stub; options/preview later.

## Out of scope for slice 1

- Firebase init, App Check, Remote Config, Firestore
- Placeholder vault, prompt rewrite, rehydration buffer
- Live chat DOM wiring