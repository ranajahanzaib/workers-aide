import { getAgentByName } from "agents";
import type { Bindings } from "./data";
export async function cleanup(env: Bindings) {
  // Purge transcript first, then its index. Failure leaves a row for the next scheduled retry.
  const expired = await env.DB.prepare(
    "SELECT id FROM conversations WHERE expires<=? LIMIT 50",
  )
    .bind(Date.now())
    .all<{ id: string }>();
  for (const row of expired.results) {
    const agent = await getAgentByName(env.BusinessChat, row.id);
    await agent.erase();
    await env.DB.prepare("DELETE FROM conversations WHERE id=?")
      .bind(row.id)
      .run();
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires<=?").bind(Date.now()),
    env.DB.prepare("DELETE FROM counters WHERE expires<=?").bind(
      Math.floor(Date.now() / 1000),
    ),
    env.DB.prepare(
      "DELETE FROM events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')",
    ),
  ]);
}
