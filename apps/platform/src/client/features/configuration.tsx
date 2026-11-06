import { Check } from "lucide-react";
import {
  type AgentConfig,
  type Business,
  templates,
  toolNames,
} from "../../shared/schema";
import { Field } from "../ui";
export function BusinessForm({
  business: b,
  save,
}: {
  business: Business;
  save: (v: Business) => Promise<void>;
}) {
  return (
    <form
      className="panel settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        void save({
          ...b,
          ...d,
          retentionDays: Number(d.retentionDays),
        } as Business);
      }}
    >
      <div className="section-heading">
        <h2>Business profile</h2>
        <span className="badge">PRIVATE CONFIGURATION</span>
      </div>
      <div className="form-grid">
        <Field label="Business name" name="name" value={b.name} />
        <Field label="Industry" name="industry" value={b.industry} />
        <Field label="Email" name="email" value={b.email} type="email" />
        <Field label="Phone" name="phone" value={b.phone} />
        <Field label="Website" name="website" value={b.website} type="url" />
        <Field
          label="Timezone"
          name="timezone"
          value={b.timezone}
          help="IANA timezone, for example Asia/Karachi"
        />
      </div>
      <Field
        label="Description"
        name="description"
        value={b.description}
        type="textarea"
      />
      <Field
        label="Services"
        name="services"
        value={b.services}
        type="textarea"
      />
      <Field label="Address" name="address" value={b.address} />
      <Field label="Opening hours" name="hours" value={b.hours} />
      <Field
        label="Conversation retention (days)"
        name="retentionDays"
        value={b.retentionDays}
        type="number"
      />
      <Field
        label="AI unavailable message"
        name="fallback"
        value={b.fallback}
        type="textarea"
      />
      <button>
        Save business details <Check size={15} />
      </button>
    </form>
  );
}
export function AgentForm({
  agent: a,
  save,
}: {
  agent: AgentConfig;
  save: (v: AgentConfig) => Promise<void>;
}) {
  return (
    <form
      className="panel settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const d = Object.fromEntries(f);
        void save({
          ...a,
          ...d,
          enabled: f.has("enabled"),
          enabledTools: f.getAll("enabledTools"),
          maxOutputTokens: Number(d.maxOutputTokens),
          maxToolSteps: Number(d.maxToolSteps),
          dailyAIRequests: Number(d.dailyAIRequests),
          maxMessages: Number(d.maxMessages),
        } as AgentConfig);
      }}
    >
      <h2>Identity & behavior</h2>
      <div className="form-grid">
        <Field label="Assistant name" name="name" value={a.name} />
        <label>
          Starting template
          <select name="template" defaultValue={a.template}>
            {Object.keys(templates).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Field label="Description" name="description" value={a.description} />
      <Field
        label="Welcome message"
        name="welcomeMessage"
        value={a.welcomeMessage}
        type="textarea"
      />
      <Field
        label="Custom instructions"
        name="instructions"
        value={a.instructions}
        type="textarea"
        help="Server authorization and truthfulness policies always apply."
      />
      <h3>Business tools</h3>
      <div className="tool-options">
        {toolNames.map((t) => (
          <label className="check" key={t}>
            <input
              type="checkbox"
              name="enabledTools"
              value={t}
              defaultChecked={a.enabledTools.includes(t)}
            />
            {t.replace(/([A-Z])/g, " $1")}
          </label>
        ))}
      </div>
      <h3>Usage safeguards</h3>
      <p className="muted">Model: GLM-4.7-Flash · Workers AI binding</p>
      <div className="form-grid">
        <Field
          label="Maximum output tokens (128–1024)"
          name="maxOutputTokens"
          type="number"
          value={a.maxOutputTokens}
        />
        <Field
          label="Maximum tool steps (1–4)"
          name="maxToolSteps"
          type="number"
          value={a.maxToolSteps}
        />
        <Field
          label="Daily AI requests (1–1000)"
          name="dailyAIRequests"
          type="number"
          value={a.dailyAIRequests}
        />
        <Field
          label="Messages per conversation (2–80)"
          name="maxMessages"
          type="number"
          value={a.maxMessages}
        />
      </div>
      <label className="check publish">
        <input type="checkbox" name="enabled" defaultChecked={a.enabled} />
        <span>
          <strong>Publish assistant</strong>
          <small>Allow website visitors to start conversations.</small>
        </span>
      </label>
      <button>
        Save assistant <Check size={15} />
      </button>
    </form>
  );
}
