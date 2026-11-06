# Security model

## Administration

Set `ADMIN_SECRET` to at least 32 random characters. No secret means no admin login. Compare SHA-256 digests without early exit; there is no expensive password hash on each request. Generate a high-entropy secret, not a human password. Successful login issues a random 8-hour HttpOnly, SameSite=Strict cookie, Secure on HTTPS. D1 stores only the session-token hash plus the admin-secret hash. Rotating the secret invalidates existing sessions on the next authorization check; logout deletes the current session. Delete all rows in `sessions` to revoke every session immediately.

Login attempts are limited to five/IP per rolling 15 minutes. All mutating API requests require an exact same-origin Origin header, including anonymous requests. Admin API access is checked server-side. No admin bearer secret is sent to chat or embedded pages. Do not cache private APIs at an intermediary. Run behind HTTPS in production.

## Visitors and model input

Conversation IDs are not authentication. Random capabilities are hashed in D1 and scoped to an existing, nonexpired conversation. Visitor credentials are retained in sessionStorage where available; blocked iframe storage falls back to memory. Connection tickets expire after 120 seconds and are sent in WebSocket URLs; they are scoped, temporary bearer credentials. Do not log query strings in external proxies. Expiry gates new connections; established connections retain their authorization until disconnect or conversation expiry. The latter is checked for each incoming frame. Reconnect renews a ticket using the capability; the React client refreshes cached tickets after 60 seconds. The iframe uses its own origin and never needs third-party cookies.

Chat accepts visitor text only and uses authoritative server history. No arbitrary SQL, JavaScript, dynamic tools, unrestricted HTTP, client tool results, or visitor RPC methods are permitted. Prompt injection remains a model-quality risk, but it cannot enable tools or bypass the form-confirmation boundary. System prompts contain no admin secrets. UI renders plain text with React escaping; no raw HTML or Markdown injection path exists. Contact forms explicitly explain persistence and appointments remain pending.

Responses include CSP, referrer protection and content-type protection. Administrative screens can be framed only by the deployment origin. `/widget` supports configured allowed origins through CSP frame-ancestors; an empty list permits all embeddings. This is defense in depth, not visitor authentication or a bot defense. Anonymous public access always has bounded budgets. IP limits use Cloudflare's trusted connecting-IP header in production; a distributed botnet can still consume quotas. Consider optional Turnstile/Cloudflare Access for higher exposure.

## Retention and limits

Conversation deletion revokes access, closes sockets, deletes linked action records and destroys the transcript. Daily cleanup deletes up to 50 expired transcripts/indexes and expires counters, sessions and 30-day event logs. Retention changes affect newly created conversations. Purging an index and a Durable Object is not a cross-resource transaction: operational failures should be retried. Keep backups only as long as your policy allows. Deleting a lead does not remove PII voluntarily typed into the transcript; delete the conversation to remove both.

This project is not certified for HIPAA, GDPR, financial services, or any regulated workload. Owners must review consent, notices, processor terms, region/residency, backups, incident response and retention before collecting sensitive data. Do not request payment credentials, medical records or identification documents in chat.

Report vulnerabilities privately to the repository maintainer; do not post secrets or personal data in public issues. See the repository profile for a current contact route. No security-contact email is invented here.
