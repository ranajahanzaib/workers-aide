import { BookOpen, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { Knowledge } from "../../shared/schema";
import { api, mutate } from "../api";
import { date, Empty, Field, type Perform } from "../ui";
import { DeleteButton } from "./records";
export function KnowledgePage({
  revision,
  perform,
}: {
  revision: number;
  perform: Perform;
}) {
  const [entries, setEntries] = useState<Knowledge[]>([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [editing, setEditing] = useState<Knowledge | null | undefined>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<Knowledge[]>("/knowledge")
      .then(setEntries)
      .catch((e) => setError(e.message));
  }, [revision]);
  return (
    <>
      <div className="toolbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search knowledge"
            placeholder="Search your knowledge…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {[
            "faq",
            "business",
            "service",
            "pricing",
            "hours",
            "contact",
            "policy",
            "note",
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button onClick={() => setEditing(null)}>
          <Plus size={16} /> Add knowledge
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {editing !== undefined && (
        <form
          className="panel settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              d = { ...Object.fromEntries(f), enabled: f.has("enabled") };
            void perform(async () => {
              await mutate(
                editing ? `/knowledge/${editing.id}` : "/knowledge",
                d,
                editing ? "PATCH" : "POST",
              );
              setEditing(undefined);
            });
          }}
        >
          <h2>{editing ? "Edit entry" : "Add a source of truth"}</h2>
          <Field label="Title" name="title" value={editing?.title ?? ""} />
          <label>
            Category
            <select name="category" defaultValue={editing?.category ?? "faq"}>
              {[
                "faq",
                "business",
                "service",
                "pricing",
                "hours",
                "contact",
                "policy",
                "note",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <Field
            label="Content"
            name="content"
            value={editing?.content ?? ""}
            type="textarea"
          />
          <label className="check">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={editing?.enabled ?? true}
            />{" "}
            Available to the assistant
          </label>
          <div className="actions">
            <button>Save entry</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(undefined)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <section className="panel">
        {entries.length === 0 ? (
          <Empty
            icon={BookOpen}
            title="What should your assistant know?"
            text="Add a FAQ, a service, or a policy. Only enabled entries are available to the assistant."
          />
        ) : (
          entries
            .filter(
              (k) =>
                (category === "all" || k.category === category) &&
                `${k.title} ${k.content}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .map((k) => (
              <article className="knowledge-row" key={k.id}>
                <div>
                  <span className="badge">{k.category}</span>
                  <h3>{k.title}</h3>
                  <p>{k.content}</p>
                  <small>
                    {k.enabled ? "Available to assistant" : "Disabled"} ·
                    Updated {date(k.updated_at)}
                  </small>
                </div>
                <div className="actions">
                  <button className="secondary" onClick={() => setEditing(k)}>
                    Edit
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      void perform(() =>
                        mutate(`/knowledge/${k.id}`, {
                          ...k,
                          enabled: !k.enabled,
                        }),
                      )
                    }
                  >
                    {k.enabled ? "Disable" : "Enable"}
                  </button>
                  <DeleteButton
                    remove={() =>
                      perform(
                        () => api(`/knowledge/${k.id}`, { method: "DELETE" }),
                        "Entry deleted.",
                      )
                    }
                  />
                </div>
              </article>
            ))
        )}
      </section>
    </>
  );
}
