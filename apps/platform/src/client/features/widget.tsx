import { useState } from "react";
import type { AgentConfig, Business } from "../../shared/schema";
import { Field } from "../ui";
export function Widget({
  business: b,
  agent,
  save,
}: {
  business: Business;
  agent?: AgentConfig;
  save: (v: Business) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${location.origin}/widget.js" data-agent="default" defer></script>`;
  return (
    <div className="widget-grid">
      <div>
        <form
          className="panel settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(e.currentTarget));
            void save({
              ...b,
              ...d,
              allowedOrigins: String(d.allowedOrigins)
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            } as Business);
          }}
        >
          <h2>Make it feel at home</h2>
          <Field
            label="Primary color"
            name="widgetColor"
            type="color"
            value={b.widgetColor}
          />
          <label>
            Launcher position
            <select name="widgetPosition" defaultValue={b.widgetPosition}>
              <option>right</option>
              <option>left</option>
            </select>
          </label>
          <label>
            Appearance
            <select name="widgetTheme" defaultValue={b.widgetTheme}>
              <option>light</option>
              <option>dark</option>
            </select>
          </label>
          <Field
            label="Allowed website origins (one per line)"
            name="allowedOrigins"
            value={b.allowedOrigins.join("\n")}
            type="textarea"
            help="Leave empty to allow embedding on any site. Include https:// and no trailing slash."
          />
          <p className="muted">
            Assistant name and greeting are configured on the Agent page.
          </p>
          <button>Save widget settings</button>
        </form>
        <section className="panel">
          <h2>A single script. A helpful presence.</h2>
          <p>Paste this before the closing body tag on your website.</p>
          <pre>{snippet}</pre>
          <button
            className="secondary"
            onClick={() =>
              void navigator.clipboard
                .writeText(snippet)
                .then(() => setCopied(true))
            }
          >
            {copied ? "Copied" : "Copy installation snippet"}
          </button>
        </section>
      </div>
      <section className="panel widget-preview">
        <div className="section-heading">
          <h2>Live preview</h2>
          <span className="badge">
            {agent?.enabled ? "PUBLISHED" : "UNPUBLISHED"}
          </span>
        </div>
        <iframe title="Assistant widget preview" src="/chat" />
        <small>This preview uses the actual public assistant.</small>
      </section>
    </div>
  );
}
