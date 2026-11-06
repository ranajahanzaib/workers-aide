import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { ArrowUp, MessageSquare, RotateCcw } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { api } from "./api";

type WidgetConfig = {
  name: string;
  welcomeMessage: string;
  enabled: boolean;
  color: string;
  theme: string;
  position: string;
  fallback: string;
  email: string;
  phone: string;
};
type Session = { id: string; token: string; ticket: string };
export function PublicChat() {
  const [config, setConfig] = useState<WidgetConfig>();
  const [session, setSession] = useState<Session>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<WidgetConfig>("/widget/config")
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (config && window.parent !== window)
      window.parent.postMessage(
        { type: "aide:config", color: config.color, position: config.position },
        "*",
      );
  }, [config]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && window.parent !== window)
        window.parent.postMessage({ type: "aide:close" }, "*");
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  async function start() {
    setError("");
    try {
      let stored: Pick<Session, "id" | "token"> | undefined;
      try {
        stored =
          JSON.parse(sessionStorage.getItem("aide-conversation") ?? "null") ??
          undefined;
      } catch {
        /* A blocked storage partition still supports an in-memory session. */
      }
      const current =
        stored ??
        (await api<Session>("/public/conversations", {
          method: "POST",
          body: "{}",
        }));
      let ticket: string;
      try {
        ({ ticket } = await api<{ ticket: string }>(
          `/public/conversations/${current.id}/ticket`,
          {
            method: "POST",
            body: "{}",
            headers: { Authorization: `Bearer ${current.token}` },
          },
        ));
      } catch {
        try {
          sessionStorage.removeItem("aide-conversation");
        } catch {}
        throw new Error("Previous conversation expired. Please start again.");
      }
      try {
        sessionStorage.setItem("aide-conversation", JSON.stringify(current));
      } catch {}
      setSession({ ...current, ticket });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main
      className={`public-chat ${config?.theme === "dark" ? "dark" : ""}`}
      style={{ "--accent": config?.color } as React.CSSProperties}
    >
      <header>
        <span className="brand-mark">
          <MessageSquare size={19} />
        </span>
        <div>
          <strong>{config?.name ?? "Business assistant"}</strong>
          <small>AI assistant · Powered by Workers AIDE</small>
        </div>
      </header>
      {session && config ? (
        <ChatSession
          key={session.id + session.ticket}
          session={session}
          config={config}
          reconnect={() => {
            setSession(undefined);
            void start();
          }}
        />
      ) : (
        <section className="chat-intro">
          <span className="eyebrow">A LITTLE HELP, RIGHT HERE</span>
          <h1>{config?.welcomeMessage ?? "Welcome."}</h1>
          <p>
            You’re speaking with AI. Please avoid sharing sensitive information.
            Contact details are stored only after you submit a form.
          </p>
          <button disabled={!config?.enabled} onClick={() => void start()}>
            {config?.enabled
              ? "Start a conversation"
              : "Assistant is not published"}{" "}
            <ArrowUp size={16} />
          </button>
          {config?.email && (
            <a href={`mailto:${config.email}`}>{config.email}</a>
          )}
          {config?.phone && <p>{config.phone}</p>}
        </section>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  );
}
function ChatSession({
  session,
  config,
  reconnect,
}: {
  session: Session;
  config: WidgetConfig;
  reconnect: () => void;
}) {
  const [connectionError, setConnectionError] = useState("");
  const connection = useAgent({
    agent: "BusinessChat",
    name: session.id,
    query: async () =>
      api<{ ticket: string }>(`/public/conversations/${session.id}/ticket`, {
        method: "POST",
        body: "{}",
        headers: { Authorization: `Bearer ${session.token}` },
      }),
    queryDeps: [session.id, session.token],
    cacheTtl: 60000,
    onConnectionError: () =>
      setConnectionError("Connection interrupted. Reconnect to continue."),
    onOpen: () => setConnectionError(""),
  });
  const { messages, sendMessage, status, error } = useAgentChat({
    agent: connection,
  });
  const [input, setInput] = useState("");
  const [form, setForm] = useState("");
  const [feedback, setFeedback] = useState("");
  const busy = status === "streaming" || status === "submitted";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ role: "user", parts: [{ type: "text", text }] });
  }
  async function action(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setFeedback("Saving…");
    try {
      const result = await api<{ message: string }>(
        `/public/conversations/${session.id}/actions/${form}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ ...data, consent: data.consent === "on" }),
        },
      );
      setFeedback(result.message);
      setForm("");
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }
  return (
    <>
      <div className="messages" aria-live="polite">
        <article className="bubble assistant">{config.welcomeMessage}</article>
        {messages.map((m) => (
          <article key={m.id} className={`bubble ${m.role}`}>
            <small>{m.role === "user" ? "You" : config.name}</small>
            {m.parts.map((p, i) =>
              p.type === "text" ? (
                <p key={`${m.id}-${i}`}>{p.text}</p>
              ) : p.type.startsWith("tool-") ? (
                <small key={`${m.id}-${i}`}>
                  Business tool ·{" "}
                  {p.type
                    .slice(5)
                    .replace(/([A-Z])/g, " $1")
                    .toLowerCase()}
                </small>
              ) : null,
            )}
          </article>
        ))}
        {busy && <p className="muted">Thinking…</p>}
        {(error || connectionError) && (
          <div role="alert" className="error">
            {connectionError || config.fallback}
            <button className="secondary" onClick={reconnect}>
              <RotateCcw size={14} /> Reconnect
            </button>
          </div>
        )}
      </div>
      <div className="quick-actions">
        <button
          className="secondary"
          onClick={() => {
            setForm("captureLead");
            setFeedback("");
          }}
        >
          Contact the business
        </button>
        <button
          className="secondary"
          onClick={() => {
            setForm("requestAppointment");
            setFeedback("");
          }}
        >
          Request appointment
        </button>
        <button
          className="secondary"
          onClick={() => {
            void api<{ message: string }>(
              `/public/conversations/${session.id}/actions/requestHumanHandoff`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${session.token}` },
                body: JSON.stringify({
                  reason: "Visitor requested human assistance.",
                }),
              },
            )
              .then((r) => setFeedback(r.message))
              .catch((e) => setFeedback(e.message));
          }}
        >
          Human help
        </button>
      </div>
      {form && (
        <form className="contact-form" onSubmit={(e) => void action(e)}>
          <h3>
            {form === "captureLead" ? "Contact request" : "Appointment request"}
          </h3>
          <p>
            No live calendar is connected. Appointment requests await business
            confirmation.
          </p>
          <label>
            Name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Email
            <input name="email" type="email" required maxLength={254} />
          </label>
          <label>
            Phone (optional)
            <input name="phone" maxLength={80} />
          </label>
          <label>
            Service
            <input name="service" required maxLength={200} />
          </label>
          {form === "requestAppointment" && (
            <>
              <label>
                Preferred date
                <input name="date" type="date" required />
              </label>
              <label>
                Preferred time (business local time)
                <input name="time" type="time" required />
              </label>
            </>
          )}
          <label>
            Notes
            <textarea name="message" maxLength={2000} />
          </label>
          <label className="check">
            <input name="consent" type="checkbox" required />I agree to store
            these details so the business can respond.
          </label>
          <div className="actions">
            <button>Submit request</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setForm("")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {feedback && (
        <p className="notice" role="status">
          {feedback}
        </p>
      )}
      <form className="composer" onSubmit={(e) => void submit(e)}>
        <label className="sr-only" htmlFor="message">
          Message
        </label>
        <input
          id="message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Ask a question…"
          disabled={busy}
        />
        <button aria-label="Send message" disabled={busy || !input.trim()}>
          <ArrowUp size={19} />
        </button>
      </form>
      {(config.email || config.phone) && (
        <small className="chat-footer">
          Contact the business directly:{" "}
          {config.email && (
            <a href={`mailto:${config.email}`}>{config.email}</a>
          )}{" "}
          {config.phone}
        </small>
      )}
      <small className="chat-footer">
        AI can make mistakes. Requests are confirmed by the business.
      </small>
    </>
  );
}
