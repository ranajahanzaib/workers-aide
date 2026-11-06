import type { AgentConfig, Business, Knowledge } from "../shared/schema";
export type Bindings = Env & { ADMIN_SECRET?: string };
export async function setting<T>(db: D1Database, id: string): Promise<T> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE id=?")
    .bind(id)
    .first<{ value: string }>();
  if (!row) throw new Error("Missing configuration");
  return JSON.parse(row.value) as T;
}
export const agentConfig = (db: D1Database) =>
  setting<AgentConfig>(db, "agent");
export const businessConfig = (db: D1Database) =>
  setting<Business>(db, "business");
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function token() {
  return crypto.randomUUID() + crypto.randomUUID();
}
export async function equalSecret(a: string, b: string) {
  const x = await hash(a),
    y = await hash(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
export async function consume(
  db: D1Database,
  key: string,
  limit: number,
  seconds = 86400,
) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      "INSERT INTO counters(key,value,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET value=CASE WHEN expires<=? THEN 1 ELSE value+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING value",
    )
    .bind(key, now + seconds, now, now)
    .first<{ value: number }>();
  if (row?.value === limit + 1) await event(db, "rate_limit.exceeded");
  return !!row && row.value <= limit;
}
export async function event(
  db: D1Database,
  name: string,
  conversation?: string,
) {
  console.log(JSON.stringify({ event: name, conversation }));
  await db
    .prepare("INSERT INTO events(id,event,conversation_id) VALUES(?,?,?)")
    .bind(crypto.randomUUID(), name, conversation ?? null)
    .run();
}
export interface KnowledgeRetriever {
  search(
    query: string,
    options?: { limit?: number; agentId?: string },
  ): Promise<Knowledge[]>;
}
export class D1KnowledgeRetriever implements KnowledgeRetriever {
  constructor(private db: D1Database) {}
  async search(query: string, options?: { limit?: number }) {
    const terms = query
      .toLowerCase()
      .match(/[\p{L}\p{N}]{2,}/gu)
      ?.slice(0, 12);
    if (!terms?.length) return [];
    const match = terms.map((t) => `"${t}"`).join(" OR ");
    const rows = await this.db
      .prepare(
        "SELECT k.* FROM knowledge k JOIN knowledge_fts f ON k.rowid=f.rowid WHERE knowledge_fts MATCH ? AND k.enabled=1 ORDER BY rank LIMIT ?",
      )
      .bind(match, Math.min(options?.limit ?? 4, 5))
      .all<Knowledge>();
    return rows.results.map((r) => ({
      ...r,
      content: r.content.slice(0, 1400),
    }));
  }
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export async function recordTokens(
  db: D1Database,
  input: number | undefined,
  output: number | undefined,
) {
  const day = new Date().toISOString().slice(0, 10);
  const statements = (
    [
      ["input", input],
      ["output", output],
    ] as const
  )
    .filter(
      (entry): entry is readonly ["input" | "output", number] =>
        entry[1] !== undefined && Number.isFinite(entry[1]),
    )
    .map(([kind, amount]) =>
      db
        .prepare(
          "INSERT INTO counters(key,value,expires) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=value+excluded.value",
        )
        .bind(
          `tokens:${day}:${kind}`,
          amount,
          Math.floor(Date.now() / 1000) + 30 * 86400,
        ),
    );
  if (statements.length) await db.batch(statements);
}
