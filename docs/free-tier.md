# Free-plan operation

Checked against official Cloudflare documentation on 2026-10-30. Quotas can change and are shared with other applications in the account.

| Service                | Free allocation / limit                                                                                                   | Source                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Workers                | 100,000 requests/day; 10 ms CPU per HTTP request; 128 MB memory                                                           | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)      |
| Workers AI             | 10,000 Neurons/day; exceeding requires a Paid upgrade                                                                     | [AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)      |
| D1                     | 5 million rows read/day; 100,000 rows written/day; 5 GB account storage                                                   | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)              |
| D1 database            | 500 MB per database; 50 queries per Worker invocation                                                                     | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)                |
| SQLite Durable Objects | 100,000 requests/day; 13,000 GB-s duration/day; 5 million rows read/day; 100,000 rows written/day; 5 GB total SQL storage | [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |

SQLite-backed Durable Objects are available on Free. This project uses `new_sqlite_classes`, never legacy KV-backed objects. The default [GLM-4.7-Flash model](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/) supports function calling and is not among the models requiring paid billing in the current AI pricing page.

Application safeguards are separate from provider billing: 100 AI conversation turns/day by default, 40 messages/conversation, 512 output tokens/step, 3 tool steps/turn, 2,000 characters/message, 16 KiB HTTP bodies, 200 knowledge entries, 4 retrieved snippets of up to 1,400 characters each, 10 new conversations/IP in a rolling day and 200 installation-wide, 100 tool calls/conversation/day. Dashboard settings can lower or raise the model budgets within validated bounds. Multiple inference steps can occur in one turn; the AI counter measures turns attempted, not individual provider requests or Neurons. IP addresses are hashed before counter storage.

FTS5 indexes keep retrieval bounded. The model receives only the latest 16 stored messages and pruned historical tool calls. An ordinary answer uses one generation; subsequent steps are bounded. There is no vector database, external LLM key, paid queue, or external auth service.

Quota errors never switch to a paid provider or retry indefinitely. AI errors show a deterministic unavailable message and leave contact/appointment forms available. A D1 failure returns an error instead of success. Provider-level Workers or database exhaustion may prevent even the fallback UI/API from loading. Keep your normal contact details on your own website as well.

Usage shows application counts, recent events, and active message/AI counters. Reported input/output token totals are accumulated when the provider returns them; these can be incomplete, are not Neurons, and are not a bill. It does **not** estimate Neurons or billing. Use the Cloudflare dashboard for authoritative billing, CPU, storage, and quota metrics. A fixed number of conversations/day cannot be promised: token lengths, tool steps, traffic, and model all affect consumption. Free CPU suitability must be measured on the deployed account with realistic traffic; a successful local build is not a production CPU benchmark.

Workers Paid raises limits and allows overage billing. The same code and SQLite migrations continue working; this project never enables a paid feature automatically. Review Cloudflare billing before raising limits. Retention cleanup removes up to 50 expired conversations per daily run, so large expiry backlogs may need additional scheduled/manual cleanup. Cleanup itself consumes queries and CPU.
