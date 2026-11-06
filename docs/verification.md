# Verification scope

Local verification on 2026-10-30:

- Dependencies installed with pnpm and a version-pinned lockfile is included.
- Local D1 migration ran successfully; setup generated a private ignored secret.
- Strict type checks include application, shared schemas, tests and Vite/Vitest configuration.
- Workers integration suite: 22 tests passing, including real D1 and Agents WebSocket transport.
- Production Vite build and Wrangler deployment dry run passed. Dry run did not upload or provision resources.
- Browser: admin login, settings persistence through publish, public session creation, honest offline inference fallback, consented contact submission, and real lead display in admin.
- Browser: independent widget loaded from a separate localhost origin, created an authorized conversation and fit a 390px viewport without horizontal overflow.

The screenshot in `images/dashboard.jpg` shows the actual local application with browser QA records, not seeded analytics. Local test records are disposable; production migration seeds no fictional business or contacts.

The chat transport tests use `MockLanguageModelV4` only inside the test file. Fixtures assert unknown-price/pending-booking text flows through the real SDK and persists. They verify plumbing and server policy boundaries, not model intelligence or live grounding reliability. Contact capture, appointments, consent, invalid/disabled tool attempts, prompt-injection attempts, idempotency, and handoff are tested through real server execution against D1.

Not verified: authenticated live Workers AI inference, remote deployment/migrations, actual Free-plan CPU/Neuron consumption, all browser/assistive-technology combinations, and production-scale cleanup. Run `AIDE_ORIGIN=https://YOUR-PUBLISHED-ORIGIN pnpm run test:live` for an optional actual streaming smoke test after deployment. That command creates a real conversation and consumes real AI quota. It never silently switches to a fixture. Manually evaluate factual answers and tools against your own business knowledge before serving customers.
