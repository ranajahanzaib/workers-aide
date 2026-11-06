# Configuration

The Settings page persists business name, description, industry, contact details, website, hours, address, services, timezone, retention and AI-unavailable message. Hours/services are plain-text reference information, not appointment availability. Dates on appointment forms use the configured business timezone. Retention defaults to 30 days and applies to new conversations.

The Agent page persists identity, welcome message, one of four templates, custom instructions, published state, enabled tools, and bounded AI budgets. Templates contribute system guidance through the same runtime. Server policy always takes precedence. Only GLM-4.7-Flash is allowlisted for this release; adding a model requires code, compatibility evaluation and live tool-calling tests. The unpublished default prevents accidental public use before setup.

Knowledge supports FAQ, business, service, pricing, hours, contact, policy and note entries. Search/filter/edit/disable/delete controls operate on D1. Each entry is limited to 6,000 characters; up to 200 entries are accepted. Disabled entries never appear in model retrieval. The displayed enabled content is the knowledge preview. No production sample business content is seeded. `examples/sample-knowledge.json` is explicitly fictional and can be manually adapted through the dashboard.

Widget settings persist primary color, launcher position, appearance, and optional allowed website origins. Agent identity and greeting are reused. Origin entries must be exact origins such as `https://www.example.com` with no trailing slash. The deployment origin is always allowed to show the local preview.

Usage counters are application-level safeguards. Their values are not invoices, token totals or Neuron estimates. See [Free-plan operation](free-tier.md) for default bounds and provider documentation.
