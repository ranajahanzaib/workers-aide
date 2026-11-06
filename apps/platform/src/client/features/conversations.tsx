import { ChevronRight, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import type { Action, Conversation } from "../../shared/schema";
import { api, mutate } from "../api";
import { date, Empty, type Perform } from "../ui";
import { DeleteButton } from "./records";
export function Conversations({
  revision,
  perform,
}: {
  revision: number;
  perform: Perform;
}) {
  const [rows, setRows] = useState<Conversation[]>([]),
    [selected, setSelected] = useState(""),
    [filter, setFilter] = useState("all"),
    [messages, setMessages] = useState<
      {
        id: string;
        role: string;
        parts: { type: string; text?: string }[];
        createdAt?: string | null;
      }[]
    >([]),
    [error, setError] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  useEffect(() => {
    api<Conversation[]>("/conversations")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [revision]);
  useEffect(() => {
    setMessages([]);
    if (selected)
      api<{ messages: typeof messages; actions: Action[] }>(
        `/conversations/${selected}`,
      )
        .then((r) => {
          setMessages(r.messages);
          setActions(r.actions);
        })
        .catch((e) => setError(e.message));
  }, [selected]);
  return (
    <>
      <div className="toolbar">
        <label>
          Status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["all", "open", "needs_attention", "resolved"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span className="muted">Latest 200 conversations</span>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="panel inbox">
        <div className="conversation-list">
          {rows.length ? (
            rows
              .filter((r) => filter === "all" || r.status === filter)
              .map((r) => (
                <button
                  key={r.id}
                  className={selected === r.id ? "selected" : ""}
                  onClick={() => setSelected(r.id)}
                >
                  <span className="conversation-icon">
                    <MessageSquare size={17} />
                  </span>
                  <span>
                    <strong>Visitor {r.id.slice(0, 6)}</strong>
                    <small>{date(r.created_at)}</small>
                    <span className="badge">
                      {r.status.replaceAll("_", " ")}
                    </span>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))
          ) : (
            <Empty
              icon={MessageSquare}
              title="Ready to listen."
              text="Your first visitor conversation will appear here."
            />
          )}
        </div>
        <div className="transcript">
          {selected ? (
            <>
              <div className="section-heading">
                <h3>Visitor {selected.slice(0, 6)}</h3>
                <select
                  aria-label="Conversation status"
                  value={rows.find((r) => r.id === selected)?.status ?? "open"}
                  onChange={(e) =>
                    void perform(() =>
                      mutate(`/conversations/${selected}`, {
                        status: e.target.value,
                      }),
                    )
                  }
                >
                  {["open", "needs_attention", "resolved"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              {messages.map((m) => (
                <article className={`bubble ${m.role}`} key={m.id}>
                  <small>
                    {m.role}
                    {m.createdAt ? ` · ${date(m.createdAt)}` : ""}
                  </small>
                  {m.parts
                    .filter((p) => p.type === "text")
                    .map((p, i) => (
                      <p key={i}>{p.text}</p>
                    ))}
                </article>
              ))}
              {actions.map((a) => {
                const input = JSON.parse(a.input);
                return (
                  <section className="notice" key={a.id}>
                    <div>
                      <strong>
                        {a.tool.replace(/([A-Z])/g, " $1")} · {a.status}
                      </strong>
                      <p>
                        {input.name} {input.email} {input.service} {input.date}{" "}
                        {input.time} {input.reason}
                      </p>
                    </div>
                  </section>
                );
              })}
              <DeleteButton
                remove={() =>
                  perform(async () => {
                    await api(`/conversations/${selected}`, {
                      method: "DELETE",
                    });
                    setSelected("");
                  }, "Conversation and linked records deleted.")
                }
              />
            </>
          ) : (
            <Empty
              icon={MessageSquare}
              title="A little more context."
              text="Select a conversation to read its history and manage its status."
            />
          )}
        </div>
      </section>
    </>
  );
}
