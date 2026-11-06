import "@vitejs/plugin-react/preamble";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Code2,
  Command,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import React, { type FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AgentConfig, Business } from "../shared/schema";
import { api, mutate } from "./api";
import { PublicChat } from "./Chat";
import { AgentForm, BusinessForm } from "./features/configuration";
import { Conversations } from "./features/conversations";
import { KnowledgePage } from "./features/knowledge";
import { Records } from "./features/records";
import { Widget } from "./features/widget";
import "./styles.css";
import { date, Empty } from "./ui";

type Usage = {
  totals: { event: string; count: number }[];
  counts: {
    conversations: number;
    leads: number;
    appointments: number;
    attention: number;
  };
  events: { event: string; created_at: string }[];
  counters: { key: string; value: number; expires: number }[];
};
const pages = [
  ["Overview", LayoutDashboard],
  ["Conversations", MessageSquare],
  ["Leads", Users],
  ["Appointments", CalendarDays],
  ["Knowledge", BookOpen],
  ["Agent", Sparkles],
  ["Widget", Code2],
  ["Usage", Activity],
  ["Settings", Settings],
] as const;
function App() {
  const [auth, setAuth] = useState<boolean>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ authenticated: boolean }>("/auth/session")
      .then((r) => setAuth(r.authenticated))
      .catch((e) => setError(e.message));
  }, []);
  if (
    location.pathname.startsWith("/chat") ||
    location.pathname.startsWith("/widget")
  )
    return <PublicChat />;
  if (auth === undefined)
    return (
      <main className="login">
        <p>{error || "Opening your workspace…"}</p>
      </main>
    );
  return auth ? (
    <Dashboard logout={() => setAuth(false)} />
  ) : (
    <Login onLogin={() => setAuth(true)} />
  );
}
function Login({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate(
        "/auth/login",
        { secret: new FormData(e.currentTarget).get("secret") },
        "POST",
      );
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="login-brand">
        <span className="brand-mark">
          <Command size={24} />
        </span>
        workers <b>AIDE</b>
      </div>
      <div className="login-card">
        <span className="eyebrow">YOUR BUSINESS. YOUR INFRASTRUCTURE.</span>
        <h1>
          A little intelligence.
          <br />A lot of possibility.
        </h1>
        <p>
          Welcome to your business agent workspace.
          <br />
          Sign in to configure, publish, and keep an eye on things.
        </p>
        <form onSubmit={(e) => void login(e)}>
          <label>
            Administrator access secret
            <input
              name="secret"
              type="password"
              autoComplete="current-password"
              required
              minLength={32}
              placeholder="Enter your deployment’s access secret"
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy}>
            {busy ? "Signing in…" : "Open workspace"} <ArrowRight size={17} />
          </button>
        </form>
        <small>
          <ShieldCheck size={14} /> Private, self-hosted, and owned by you.
        </small>
      </div>
      <footer>AI Deployed at the Edge · Open-source by design</footer>
    </main>
  );
}
function Dashboard({ logout }: { logout: () => void }) {
  const [page, setPage] = useState("Overview");
  const [usage, setUsage] = useState<Usage>();
  const [agent, setAgent] = useState<AgentConfig>();
  const [business, setBusiness] = useState<Business>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [menu, setMenu] = useState(false);
  function refresh() {
    setRevision((v) => v + 1);
  }
  useEffect(() => {
    Promise.all([
      api<Usage>("/usage"),
      api<AgentConfig>("/agents/default"),
      api<Business>("/business"),
    ])
      .then(([u, a, b]) => {
        setUsage(u);
        setAgent(a);
        setBusiness(b);
      })
      .catch((e) => setError(e.message));
  }, [revision, page]);
  async function perform(
    fn: () => Promise<unknown>,
    message = "Changes saved.",
  ) {
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(message);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const title =
    page === "Overview"
      ? "A clear view of your business."
      : page === "Agent"
        ? "One assistant. Your way."
        : page === "Knowledge"
          ? "Good answers start here."
          : page === "Widget"
            ? "A warm welcome, anywhere."
            : page === "Settings"
              ? "The details that matter."
              : page === "Usage"
                ? "Know what’s running."
                : page === "Conversations"
                  ? "Every conversation, in context."
                  : page === "Leads"
                    ? "The start of something good."
                    : "Requests, ready for your review.";
  return (
    <div className="workspace">
      <aside className={menu ? "sidebar visible" : "sidebar"}>
        <a className="logo" href="/">
          <span className="brand-mark">
            <Command size={20} />
          </span>
          <span>
            workers <b>AIDE</b>
          </span>
        </a>
        <div className="workspace-name">
          <span>{business?.name.slice(0, 2).toUpperCase() ?? "WA"}</span>
          <div>
            {business?.name ?? "Your workspace"}
            <small>Business workspace</small>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {pages.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => {
                setPage(name);
                setMenu(false);
                setNotice("");
                setError("");
              }}
            >
              <Icon size={18} />
              {name}
              {name === "Conversations" && !!usage?.counts.attention && (
                <em>{usage.counts.attention}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="ownership">
            <ShieldCheck size={18} />
            <strong>Your edge. Your data.</strong>
            <p>Running in your Cloudflare account. Open source, always.</p>
          </div>
          <button
            className="logout"
            onClick={() =>
              void perform(async () => {
                await mutate("/auth/logout", {}, "POST");
                logout();
              })
            }
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="mobile-menu secondary"
            onClick={() => setMenu(!menu)}
          >
            Menu
          </button>
          <div>
            Workspace <ChevronRight size={13} /> <strong>{page}</strong>
          </div>
          <a href="/chat" target="_blank" rel="noreferrer">
            Open assistant <ExternalLink size={14} />
          </a>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{page.toUpperCase()}</span>
              <h1>{title}</h1>
              <p>
                {page === "Overview"
                  ? "Your assistant is here to help. Here’s how things are going."
                  : subtitles[page]}
              </p>
            </div>
            {page === "Overview" && (
              <span className={`status ${agent?.enabled ? "live" : ""}`}>
                <i />
                {agent?.enabled ? "Agent published" : "Agent unpublished"}
              </span>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}
          {page === "Overview" && usage && (
            <>
              <div className="metrics">
                {[
                  ["Conversations", usage.counts.conversations, MessageSquare],
                  ["Captured leads", usage.counts.leads, Users],
                  ["Pending requests", usage.counts.appointments, CalendarDays],
                  ["Needs attention", usage.counts.attention, Activity],
                ].map(([label, count, Icon]) => {
                  const I = Icon as typeof Activity;
                  return (
                    <div className="metric" key={String(label)}>
                      <div>
                        <span>{String(label)}</span>
                        <I size={17} />
                      </div>
                      <strong>{String(count)}</strong>
                      <small>
                        {label === "Needs attention"
                          ? "Waiting for a human touch"
                          : "Actual records in your workspace"}
                      </small>
                    </div>
                  );
                })}
              </div>
              <div className="overview-grid">
                <section className="panel agent-panel">
                  <div className="section-heading">
                    <h2>Your business assistant</h2>
                    <Sparkles size={18} />
                  </div>
                  <span className="agent-avatar">
                    <Command size={28} />
                  </span>
                  <h3>{agent?.name}</h3>
                  <p>{agent?.description}</p>
                  <dl>
                    <div>
                      <dt>Model</dt>
                      <dd>GLM-4.7-Flash</dd>
                    </div>
                    <div>
                      <dt>Runtime</dt>
                      <dd>Cloudflare Workers AI</dd>
                    </div>
                    <div>
                      <dt>Enabled tools</dt>
                      <dd>{agent?.enabledTools.length} business tools</dd>
                    </div>
                  </dl>
                  <button
                    className="secondary"
                    onClick={() => setPage("Agent")}
                  >
                    Configure assistant <ArrowRight size={15} />
                  </button>
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>A thoughtful place to start</h2>
                    <span className="badge">SETUP</span>
                  </div>
                  <p className="muted">
                    A useful assistant starts with a little context. Make it
                    yours in a few small steps.
                  </p>
                  {[
                    [
                      "01",
                      "Tell us about your business",
                      "Add the details your visitors should know.",
                      "Settings",
                      business?.name !== "Your business",
                    ],
                    [
                      "02",
                      "Give your assistant knowledge",
                      "Add services, FAQs, prices, and policies.",
                      "Knowledge",
                      false,
                    ],
                    [
                      "03",
                      "Make yourself at home",
                      "Choose the greeting, behavior, and tools.",
                      "Agent",
                      agent?.enabled,
                    ],
                    [
                      "04",
                      "Meet your visitors where they are",
                      "Add a small chat widget to your website.",
                      "Widget",
                      false,
                    ],
                  ].map(([num, title, desc, target, done]) => (
                    <button
                      className="setup-row"
                      key={String(num)}
                      onClick={() => setPage(String(target))}
                    >
                      <span className={done ? "step complete" : "step"}>
                        {done ? <Check size={16} /> : num}
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <small>{desc}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </section>
              </div>
              <section className="panel activity-panel">
                <div className="section-heading">
                  <h2>Recent activity</h2>
                  <span className="muted">From your deployment</span>
                </div>
                {usage.events.length ? (
                  usage.events.slice(0, 6).map((e, i) => (
                    <div className="activity-row" key={`${e.created_at}-${i}`}>
                      <span className="activity-dot" />
                      <span>{e.event.replaceAll(".", " · ")}</span>
                      <time>{date(e.created_at)}</time>
                    </div>
                  ))
                ) : (
                  <Empty
                    icon={Activity}
                    title="A quiet start."
                    text="Activity appears here when visitors start conversations and your assistant gets to work."
                  />
                )}
              </section>
            </>
          )}
          {page === "Settings" && business && (
            <BusinessForm
              key={revision}
              business={business}
              save={(v) => perform(() => mutate("/business", v))}
            />
          )}
          {page === "Agent" && agent && (
            <AgentForm
              key={revision}
              agent={agent}
              save={(v) => perform(() => mutate("/agents/default", v))}
            />
          )}
          {page === "Knowledge" && (
            <KnowledgePage revision={revision} perform={perform} />
          )}
          {page === "Conversations" && (
            <Conversations revision={revision} perform={perform} />
          )}
          {(page === "Leads" || page === "Appointments") && (
            <Records
              key={page}
              kind={page === "Leads" ? "leads" : "appointments"}
              revision={revision}
              perform={perform}
            />
          )}
          {page === "Widget" && business && (
            <Widget
              business={business}
              agent={agent}
              save={(v) => perform(() => mutate("/business", v))}
            />
          )}
          {page === "Usage" && usage && (
            <>
              <div className="panel">
                <h2>Application safeguards</h2>
                <p>
                  These counters measure this application, not Cloudflare
                  billing. Check your Cloudflare dashboard for actual Neuron,
                  CPU, request, and storage usage.
                </p>
                <dl className="usage-list">
                  <div>
                    <dt>Daily AI request cap</dt>
                    <dd>{agent?.dailyAIRequests}</dd>
                  </div>
                  <div>
                    <dt>Messages per conversation</dt>
                    <dd>{agent?.maxMessages}</dd>
                  </div>
                  <div>
                    <dt>Maximum tool steps per response</dt>
                    <dd>{agent?.maxToolSteps}</dd>
                  </div>
                  <div>
                    <dt>Maximum output tokens</dt>
                    <dd>{agent?.maxOutputTokens}</dd>
                  </div>
                  <div>
                    <dt>Knowledge entries / context</dt>
                    <dd>200 entries / up to 5,600 characters</dd>
                  </div>
                  <div>
                    <dt>Conversation retention</dt>
                    <dd>{business?.retentionDays} days</dd>
                  </div>
                </dl>
                <a
                  className="text-link"
                  href="https://dash.cloudflare.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Cloudflare dashboard <ExternalLink size={14} />
                </a>
              </div>
              <section className="panel">
                <h2>Active usage counters</h2>
                {usage.counters.length ? (
                  usage.counters.map((c) => (
                    <div className="activity-row" key={c.key}>
                      <code>{c.key}</code>
                      <strong>{c.value}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">No AI requests yet.</p>
                )}
              </section>
              <section className="panel">
                <h2>Operational totals (last 30 days)</h2>
                {usage.totals.map((row) => (
                  <div className="activity-row" key={row.event}>
                    <span>{row.event.replaceAll(".", " · ")}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
                <h2 style={{ marginTop: 24 }}>Recent events</h2>
                {usage.events.map((e, i) => (
                  <div className="activity-row" key={i}>
                    <span>{e.event}</span>
                    <time>{date(e.created_at)}</time>
                  </div>
                ))}
              </section>
            </>
          )}
          <footer className="workspace-footer">
            <span>
              Workers AIDE <span className="dot-sep">/</span> AI Deployed at the
              Edge
            </span>
            <span>Self-hosted. Business-minded.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
const subtitles: Record<string, string> = {
  Conversations: "Read the history, pick up a handoff, and close the loop.",
  Leads: "Real contact requests, shared with your visitors’ consent.",
  Appointments: "Review preferences and confirm requests when you’re ready.",
  Knowledge: "A small, reliable source of truth for your assistant.",
  Agent: "Set the voice, the boundaries, and the work it can do.",
  Widget: "Bring your assistant to your website with a single script.",
  Usage: "Real application counters and sensible limits.",
  Settings:
    "Help your assistant understand the business behind the conversation.",
};
const root = document.getElementById("root");
if (!root) throw new Error("Missing app root");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
