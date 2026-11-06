# Embed the assistant

Publish the agent in the dashboard, open Widget, configure its appearance, save, and copy the generated snippet:

```html
<script
  src="https://YOUR-WORKER.workers.dev/widget.js"
  data-agent="default"
  defer
></script>
```

Only the `default` published profile exists in v1. The loader runs without React on the host page. It uses a Shadow DOM launcher and an isolated sandboxed iframe at `/widget`. The iframe communicates with its own backend origin; host cookies and third-party cookies are not needed. It supports opening/closing, Escape, a descriptive frame title, focus return, accessible labels, streaming history, and persistent requests. Current-tab history resumes using a conversation credential in sessionStorage when the browser permits it.

Optional allowed origins are enforced by CSP frame-ancestors on the iframe response. With no allowlist, embedding is public. This does not authorize data access; visitor capabilities and rate limits still apply. Host CSP must permit this deployment in script-src and frame-src. Do not serve this loader through an origin that you do not control.

`examples/embed.html` is a separate-origin test harness. Replace its script URL or serve it from another local port while the application runs on port 5173. Check your browser's iframe storage policy if reloads do not resume history. Closing the panel does not delete the conversation.
