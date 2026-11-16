# PII Airlock

Chrome extension (Manifest V3) for the [#BuildHybridAI 2026](https://buildhybridai.devpost.com/) hackathon: detect sensitive data in chat prompts, mask it before send, and restore it in responses. This repo is built in vertical slices; **slice 1** ships MV3 scaffolding, regex PII detectors, merge/dedupe logic, and unit tests. Firebase AI Logic hybrid inference is a follow-up slice (APIs must be verified against official docs — nothing is guessed here).

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
```

## Scripts

| Command        | Purpose                          |
|----------------|----------------------------------|
| `npm run dev`  | Vite dev build with CRX HMR      |
| `npm run build`| Production extension to `dist/`  |
| `npm test`     | Vitest unit tests                |
| `npm run lint` | ESLint                           |

## Load unpacked (manual check in Chrome)

1. Run `npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the `dist/` directory.
4. Open the extension popup; status should show **Extension connected**.
5. On any page, the content script should load without errors (see service worker / page console — no prompt text is logged).

## Project layout

- `src/detection/` — regex detectors, merge logic, types
- `src/config/chat-sites.ts` — chat DOM selectors (empty until user-verified slice)
- `src/background/` — service worker + messaging
- `src/content/` — content script stub
- `src/popup/` — popup UI stub
- `SPEC.md` — plan, rules, build order

## License

Apache License 2.0 — see [LICENSE](LICENSE).