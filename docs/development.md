# Development

Use Node 22+ and pnpm 10.28.2 (the packageManager field pins the version). From the repository root:

```sh
pnpm install
pnpm run setup
pnpm dev
```

`setup` creates an ignored `apps/platform/.dev.vars` with a cryptographically random admin secret and runs local D1 migrations. Read the secret privately in your editor; it is never printed by setup. Open the URL printed by Vite and sign in with that secret. The initial assistant is unpublished. Configure business, knowledge and agent before publishing.

Workers AI always runs remotely and needs Cloudflare authentication (`pnpm --filter @aide/platform exec wrangler login`). No external paid model API key is required. Start with `AIDE_REMOTE_AI=1 pnpm dev` to enable remote inference after login. Plain `pnpm dev` disables remote bindings so the dashboard and real local forms can be used offline. Without inference access the app displays a clear unavailable response; contact/appointment/handoff forms use real local D1 independently. Production never substitutes fake answers. CI mocks are test-only.

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @aide/platform types
pnpm db:migrate
```

The Cloudflare Vitest plugin runs integration tests inside workerd with local D1, real migrations and Durable Objects. AI is not called by ordinary tests. Tests validate storage, authorization, isolation, tool policy, idempotency and limits. Behavioral model evaluation and actual Free CPU timing need a separate authenticated live smoke test. Testing a prompt string is not proof of live model behavior.

Local persistence is under `apps/platform/.wrangler/state`; do not commit it. Vitest resources are isolated from dev D1. Vite's plugin and Wrangler migration commands use the same default local persistence directory. Never run remote migrations when you intended a local reset. No reset script is provided because deletion is destructive.
