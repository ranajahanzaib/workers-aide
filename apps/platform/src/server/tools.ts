export class ToolPolicyError extends Error {}

import { z } from "zod";
import {
  appointmentSchema,
  contactSchema,
  type ToolName,
} from "../shared/schema";
import {
  agentConfig,
  businessConfig,
  consume,
  D1KnowledgeRetriever,
  event,
  hash,
} from "./data";
export const toolSchemas = {
  searchKnowledge: z.object({ query: z.string().min(1).max(300) }),
  getBusinessInformation: z.object({}),
  captureLead: contactSchema,
  requestAppointment: appointmentSchema,
  requestHumanHandoff: z.object({ reason: z.string().min(1).max(1000) }),
};
export type ToolContext = {
  db: D1Database;
  conversationId: string;
  agentId: string;
  visitorConfirmed: boolean;
};
async function runTool(name: ToolName, input: unknown, ctx: ToolContext) {
  const config = await agentConfig(ctx.db);
  if (
    !config.enabled ||
    !config.enabledTools.includes(name) ||
    config.id !== ctx.agentId
  )
    throw new ToolPolicyError("Tool is disabled");
  const conversation = await ctx.db
    .prepare(
      "SELECT id FROM conversations WHERE id=? AND agent_id=? AND expires>?",
    )
    .bind(ctx.conversationId, ctx.agentId, Date.now())
    .first();
  if (!conversation) throw new ToolPolicyError("Conversation unavailable");
  const parsed = toolSchemas[name].safeParse(input);
  if (!parsed.success) throw new ToolPolicyError("Invalid tool arguments");
  if (!(await consume(ctx.db, `tools:${ctx.conversationId}`, 100)))
    throw new ToolPolicyError("Tool limit reached");
  if (name === "searchKnowledge")
    return {
      ok: true,
      entries: await new D1KnowledgeRetriever(ctx.db).search(
        z.object({ query: z.string() }).parse(input).query,
      ),
    };
  if (name === "getBusinessInformation") {
    const b = await businessConfig(ctx.db);
    return {
      ok: true,
      business: {
        name: b.name,
        description: b.description,
        email: b.email,
        phone: b.phone,
        address: b.address,
        hours: b.hours,
        services: b.services,
        timezone: b.timezone,
      },
    };
  }
  if (
    (name === "captureLead" || name === "requestAppointment") &&
    !ctx.visitorConfirmed
  )
    throw new ToolPolicyError("Visitor must confirm the contact form");
  if (name === "requestAppointment") {
    const a = appointmentSchema.parse(input);
    const b = await businessConfig(ctx.db);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: b.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (a.date < today) throw new ToolPolicyError("Choose a future date");
  }
  const id = await hash(
    JSON.stringify([ctx.conversationId, name, parsed.data]),
  );
  const result = await ctx.db
    .prepare(
      "INSERT OR IGNORE INTO actions(id,conversation_id,tool,input,status) VALUES(?,?,?,?,?)",
    )
    .bind(
      id,
      ctx.conversationId,
      name,
      JSON.stringify(parsed.data),
      name === "requestAppointment"
        ? "pending"
        : name === "captureLead"
          ? "new"
          : "open",
    )
    .run();
  if (name === "requestHumanHandoff")
    await ctx.db
      .prepare("UPDATE conversations SET status='needs_attention' WHERE id=?")
      .bind(ctx.conversationId)
      .run();
  if (result.meta.changes)
    await event(ctx.db, `tool.${name}.succeeded`, ctx.conversationId);
  return {
    ok: true,
    id,
    status:
      name === "requestAppointment"
        ? "pending"
        : name === "captureLead"
          ? "new"
          : "needs_attention",
    message:
      name === "requestAppointment"
        ? "Appointment request saved, awaiting business confirmation."
        : name === "requestHumanHandoff"
          ? "Human assistance request recorded in the inbox. No notification was sent."
          : "Contact request saved.",
  };
}

export async function executeTool(
  name: ToolName,
  input: unknown,
  ctx: ToolContext,
) {
  try {
    const result = await runTool(name, input, ctx);
    await event(ctx.db, "tool.executed", ctx.conversationId);
    return result;
  } catch (error) {
    try {
      await event(ctx.db, "tool.failed", ctx.conversationId);
    } catch {
      console.error(
        JSON.stringify({
          event: "tool.failed",
          conversation: ctx.conversationId,
        }),
      );
    }
    if (error instanceof ToolPolicyError) throw error;
    throw new ToolPolicyError("Business storage is unavailable. Please retry.");
  }
}
