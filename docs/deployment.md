# Deploy to your Cloudflare account

Requires Node 22+, pnpm, and a Cloudflare account with Workers, D1, Workers AI and SQLite Durable Objects available. This is a guided manual deployment, not one click. No remote resource is provisioned by installation or local setup.

From the repository root:

```sh
pnpm install
pnpm --filter @aide/platform exec wrangler login
pnpm --filter @aide/platform exec wrangler d1 create workers-aide
```

Copy the returned `database_id` into `apps/platform/wrangler.jsonc`, replacing the zero UUID. Keep the binding name `DB`. The checked-in zero UUID is a local-development placeholder and must never be used for a real deploy.

Generate a production access secret with a password manager or a cryptographic random generator (at least 32 random characters), and enter it interactively:

```sh
pnpm --filter @aide/platform exec wrangler secret put ADMIN_SECRET
pnpm --filter @aide/platform exec wrangler d1 migrations apply workers-aide --remote
pnpm run deploy:check
pnpm run deploy
```

Wrangler may ask to create the Worker when setting the first secret. Review prompts. Migration application is additive; back up real data before future schema changes. Do not overwrite an existing deployment's resources without checking its configuration. `deploy:check` validates local config and queries the remote secret **names**, not their values; it requires authentication. The deploy command runs typecheck, tests, build, and Wrangler upload. It never commits/pushes Git.

Open the deployment URL printed by Wrangler. Sign in with the production access secret. Configure Settings, add real Knowledge, configure the Agent, and check Publish assistant. Open `/chat` and test factual grounding, a real contact form, a pending appointment and human handoff before embedding. Check the resulting records in the dashboard. Review Cloudflare CPU and AI quotas using realistic traffic. Neither build nor CI makes a live inference request.

The default `AI` binding uses Cloudflare Workers AI. It is not an OpenAI/Anthropic integration. The model, D1, and SQLite Durable Objects are compatible with the documented Free offering; actual resource consumption depends on workload. No paid upgrade is enabled automatically. See [limits](free-tier.md).

## Rotation and operations

Rotate the admin secret with `wrangler secret put ADMIN_SECRET`; session validation checks the current secret's digest, so old sessions stop working. Keep the secret in a password manager. Never pass it as a command-line argument or commit `.dev.vars`. Daily retention runs at 03:17 UTC, bounded to 50 conversations/run. Check invocation errors for cleanup backlogs.

Use `pnpm --filter @aide/platform exec wrangler tail` for sanitized event logs and the Cloudflare dashboard for authoritative metrics. Never add full prompts, transcript contents, credentials or contact details to logs. `wrangler d1 export workers-aide --remote --output backup.sql` exports sensitive data: store it securely outside Git. Configure your own backup and retention policy.

If your account disables workers.dev, configure a custom domain before embedding. The widget must point at the final HTTPS origin. Add allowed website origins on the Widget page if desired. No email/SMS/calendar service needs provisioning.
