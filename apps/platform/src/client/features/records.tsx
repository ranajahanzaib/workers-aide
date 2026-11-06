import { ArrowDownToLine, CalendarDays, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { Action } from "../../shared/schema";
import { api, mutate } from "../api";
import { date, Empty, type Perform } from "../ui";
export function DeleteButton({ remove }: { remove: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <>
      <button className="danger" onClick={() => void remove()}>
        Confirm delete
      </button>
      <button className="secondary" onClick={() => setConfirm(false)}>
        Keep
      </button>
    </>
  ) : (
    <button className="text-danger secondary" onClick={() => setConfirm(true)}>
      Delete
    </button>
  );
}
export function Records({
  kind,
  revision,
  perform,
}: {
  kind: "leads" | "appointments";
  revision: number;
  perform: Perform;
}) {
  const [rows, setRows] = useState<Action[]>([]),
    [filter, setFilter] = useState("all"),
    [error, setError] = useState("");
  useEffect(() => {
    api<Action[]>(`/${kind}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [kind, revision]);
  const statuses =
    kind === "leads"
      ? ["new", "contacted", "qualified", "closed"]
      : ["pending", "confirmed", "declined", "cancelled"];
  return (
    <>
      <div className="toolbar">
        <label>
          Status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["all", ...statuses].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {kind === "leads" && (
          <a className="button secondary" href="/api/leads/export">
            <ArrowDownToLine size={16} /> Export CSV
          </a>
        )}
        <span className="muted">Latest 200 records</span>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="panel">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Service & details</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => filter === "all" || r.status === filter)
                  .map((r) => {
                    const d = JSON.parse(r.input);
                    return (
                      <tr key={r.id}>
                        <td>
                          <strong>{d.name}</strong>
                          <a href={`mailto:${d.email}`}>{d.email}</a>
                          <small>{d.phone}</small>
                        </td>
                        <td>
                          <strong>{d.service}</strong>
                          {d.date && (
                            <small>
                              {d.date} · {d.time} (business timezone)
                            </small>
                          )}
                          <p>{d.message}</p>
                        </td>
                        <td>
                          <select
                            aria-label={`Status for ${d.name}`}
                            value={r.status}
                            onChange={(e) =>
                              void perform(() =>
                                mutate(`/${kind}/${r.id}`, {
                                  status: e.target.value,
                                }),
                              )
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>{date(r.created_at)}</td>
                        <td>
                          <DeleteButton
                            remove={() =>
                              perform(
                                () =>
                                  api(`/${kind}/${r.id}`, { method: "DELETE" }),
                                "Record deleted.",
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={kind === "leads" ? Users : CalendarDays}
            title={
              kind === "leads"
                ? "A new connection starts here."
                : "Room for what’s next."
            }
            text={
              kind === "leads"
                ? "Contact requests appear here after visitors review and submit their details."
                : "Appointment requests appear here when visitors submit their preferences. No bookings are automatically confirmed."
            }
          />
        )}
      </section>
    </>
  );
}
