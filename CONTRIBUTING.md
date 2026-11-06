# Contributing to Workers AIDE

Use Node 22+ and pnpm. Read [local development](docs/development.md), [architecture](docs/architecture.md), and [security](docs/security.md) before changing the agent or APIs.

Run `pnpm install`, `pnpm run setup`, and `pnpm dev`. Keep actual secrets and local state out of Git. Ordinary CI must never need production credentials or call a paid inference service.

Before a pull request, run `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Add meaningful failure-path tests for authorization, consent or persistence changes. Explain user-visible behavior, migration requirements and validation. Do not claim live AI behavior was verified with mocked responses.

Use a focused branch. Discuss substantial feature additions first. Preserve the single-business deployment and Free-compatible defaults. Never add arbitrary model-controlled code execution. Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
