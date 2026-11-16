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

## Firebase AI Logic (hybrid inference)

Config is injected at build time and never committed. Copy `.env.example` to `.env.local`, fill in
the Firebase web config, and (for debug builds) `VITE_APPCHECK_DEBUG_TOKEN` (`true` to have the SDK
generate one, then register it in the Firebase console, or paste a registered token). `.env*` files
are git-ignored. Then `npm run build`.

- Inference runs in an offscreen document (`src/inference/offscreen.html`), because the Prompt API
  is not expected to exist in the service worker. The service worker only routes messages.
- The popup shows the inference mode setting and which backend ran last (from the SDK's
  `inferenceSource`). Default is prefer-on-device; cloud-only and on-device-only exist for testing.
- `chrome-extension://<id>/src/diagnostics/diagnostics.html` (popup: "Open diagnostics") downloads
  the on-device model (needs a click), checks `LanguageModel` in the page and in the offscreen
  host, and runs detection per mode.

## Load unpacked (manual check in Chrome)

1. Run `npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the `dist/` directory.
4. Open the extension popup; status should show **Extension connected**.
5. On any page, the content script should load without errors (see service worker / page console — no prompt text is logged).

## Project layout

- `src/detection/` — regex detectors, merge logic, types
- `src/config/chat-sites.ts` — chat DOM selectors (empty until user-verified slice)
- `src/firebase/` — Firebase init (env config, App Check debug wiring)
- `src/inference/` — hybrid model client, offscreen host, service-worker bridge, mode logic
- `src/diagnostics/` — manual verification page
- `src/background/` — service worker + messaging
- `src/content/` — content script stub
- `src/popup/` — popup UI stub
- `SPEC.md` — plan, rules, build order

## License

Apache License 2.0 — see [LICENSE](LICENSE).