# Architecture

One business, one Worker deployment, one published agent profile. React/Vite static assets, Hono API, widget loader, and Agents routing share an origin. `default` is an explicit profile identifier; D1 conversations carry `agent_id`. There is no public tenant registration or global SaaS control plane.

D1 stores business/agent JSON configuration, indexed FTS5 knowledge, hashed sessions, hashed visitor credentials, conversation metadata, business actions, expiring counters, and sanitized events. Bound SQL parameters are used for values. No ORM or external database is required.

Each conversation has its own `BusinessChat` SQLite-backed Durable Object. `AIChatAgent` owns message persistence and streaming; transcripts are not duplicated into D1. The administrator reads a transcript by server-only Durable Object RPC. Visitor routing requires a short-lived ticket tied to that conversation before either HTTP or WebSocket access. Tickets are renewed using a long-lived conversation capability sent in an Authorization header. Neither the capability nor the admin secret goes into a URL.

The model is centralized as GLM-4.7-Flash via `createAI` from `agents/models/ai-sdk`. SDK `streamText`, `pruneMessages`, and `stepCountIs` bound execution. Worker-side tools are an explicit registry with Zod schemas, configuration permissions, conversation ownership, expiry and rate checks. The server prompt embeds bounded retrieved knowledge and business information as reference data.

Write tool policy is deliberately stronger than a model-generated consent boolean: contact/appointment tools prepare a form; the visitor must submit it through the scoped endpoint with an explicit consent checkbox. The endpoint runs the same deterministic executor. The LLM cannot impersonate that confirmation. Handoff records a request without claiming a notification. Contact/appointment tools never confirm availability. Action IDs hash normalized inputs, tool name and conversation ID; a primary-key constraint deduplicates concurrent retries. Administrators separately update action status.

The chat ingress wrapper discards all supplied history except the latest validated user text, then uses server history. Visitor-supplied tool outputs, approvals, clear-history messages, state mutation and RPC calls are not forwarded. Only chat, cancel and resumable-stream protocol frames are supported. This wrapper is intentionally tied to the pinned SDK protocol and covered by integration tests when upgrading.

`KnowledgeRetriever` is a narrow extension point for future semantic search. Templates share the same runtime. Calendar/CRM/email integrations, ingestion pipelines, agents calling agents, billing and organization switching are intentionally absent.
