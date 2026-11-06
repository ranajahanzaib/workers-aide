import { AIChatAgent } from "@cloudflare/ai-chat";
import type { Connection, ConnectionContext } from "agents";
import { createAI } from "agents/models/ai-sdk";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type GenerateTextOnFinishCallback,
  pruneMessages,
  stepCountIs,
  streamText,
  tool,
  type ToolSet,
} from "ai";
import { z } from "zod";
import {
  agentConfig,
  type Bindings,
  businessConfig,
  consume,
  D1KnowledgeRetriever,
  event,
  recordTokens,
} from "./data";
import { systemPrompt } from "./prompt";
import { executeTool, toolSchemas } from "./tools";

const userMessage = z.object({
  id: z.string().min(1).max(100),
  role: z.literal("user"),
  parts: z
    .array(
      z.object({ type: z.literal("text"), text: z.string().min(1).max(2000) }),
    )
    .min(1)
    .max(1),
});
export class BusinessChat extends AIChatAgent<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    const sdkMessage = this.onMessage.bind(this);
    this.onMessage = async (connection, message) => {
      if (typeof message !== "string" || message.length > 100000) {
        connection.close(1009, "Message too large");
        return;
      }
      let frame: {
        type: string;
        init?: { body?: string; method?: string };
        id?: string;
      };
      try {
        frame = z
          .object({
            type: z.string(),
            init: z
              .object({
                body: z.string().optional(),
                method: z.string().optional(),
              })
              .optional(),
            id: z.string().optional(),
          })
          .passthrough()
          .parse(JSON.parse(message));
      } catch {
        connection.close(1008, "Invalid message");
        return;
      }
      const row = await this.env.DB.prepare(
        "SELECT id FROM conversations WHERE id=? AND expires>?",
      )
        .bind(this.name, Date.now())
        .first();
      if (!row) {
        connection.close(1008, "Conversation expired");
        return;
      }
      if (frame.type === "cf_agent_use_chat_request") {
        let body: {
          messages?: unknown[];
          clientTools?: unknown;
          trigger?: unknown;
        };
        try {
          body = z
            .object({
              messages: z.array(z.unknown()).optional(),
              clientTools: z.unknown().optional(),
            })
            .parse(JSON.parse(frame.init?.body ?? "{}"));
        } catch {
          connection.close(1008, "Invalid body");
          return;
        }
        const parsed = userMessage.safeParse(body.messages?.at(-1));
        if (!parsed.success) {
          connection.close(1008, "Only visitor text is allowed");
          return;
        }
        // Ignore all client-provided history and tool results: only server-persisted history is authoritative.
        if (this.messages.some((m) => m.id === parsed.data.id)) return;
        const config = await agentConfig(this.env.DB);
        if (
          !config.enabled ||
          !(await consume(
            this.env.DB,
            `ingress:${this.name}`,
            config.maxMessages,
          ))
        ) {
          connection.close(1008, "Conversation message limit reached");
          return;
        }
        body.messages = [
          ...this.messages,
          { ...parsed.data, metadata: { createdAt: new Date().toISOString() } },
        ];
        delete body.clientTools;
        frame.init = { method: "POST", body: JSON.stringify(body) };
        await sdkMessage(connection, JSON.stringify(frame));
        return;
      }
      if (
        [
          "cf_agent_stream_resume_request",
          "cf_agent_stream_resume_ack",
          "cf_agent_chat_request_cancel",
        ].includes(frame.type)
      )
        await sdkMessage(connection, message);
    };
  }
  async onConnect(connection: Connection, context: ConnectionContext) {
    await super.onConnect(connection, context);
  }
  validateStateChange() {
    throw new Error("Visitor state mutation is disabled");
  }
  async onRequest() {
    return new Response("Unsupported agent request", { status: 405 });
  }
  async transcript() {
    return this.messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts
        .filter((p) => p.type === "text")
        .map((p) => ({ type: "text", text: p.text })),
      createdAt:
        z.object({ createdAt: z.string() }).safeParse(m.metadata).data
          ?.createdAt ?? null,
    }));
  }
  async erase() {
    for (const connection of this.getConnections())
      connection.close(1008, "Conversation deleted");
    await this.destroy();
  }
  async onChatMessage(
    onFinish: GenerateTextOnFinishCallback<ToolSet>,
    options?: { abortSignal?: AbortSignal },
  ) {
    const [config, business] = await Promise.all([
      agentConfig(this.env.DB),
      businessConfig(this.env.DB),
    ]);
    const fallback = (text: string) =>
      createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: ({ writer }) => {
            writer.write({ type: "text-start", id: "fallback" });
            writer.write({ type: "text-delta", id: "fallback", delta: text });
            writer.write({ type: "text-end", id: "fallback" });
          },
        }),
      });
    if (!config.enabled)
      return fallback("This assistant is currently unpublished.");
    if (
      this.messages.length > config.maxMessages * 2 ||
      !(await consume(
        this.env.DB,
        `messages:${this.name}`,
        config.maxMessages,
      )) ||
      !(await consume(
        this.env.DB,
        `ai:${new Date().toISOString().slice(0, 10)}`,
        config.dailyAIRequests,
      ))
    )
      return fallback(
        "The conversation or daily AI limit has been reached. You can use the contact form below.",
      );
    await event(this.env.DB, "message.received", this.name);
    const latest =
      this.messages
        .at(-1)
        ?.parts.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(" ") ?? "";
    const knowledge = await new D1KnowledgeRetriever(this.env.DB).search(
      latest,
    );
    const ctx = {
      db: this.env.DB,
      conversationId: this.name,
      agentId: config.id,
      visitorConfirmed: false,
    };
    const tools: ToolSet = {};
    if (config.enabledTools.includes("searchKnowledge"))
      tools.searchKnowledge = tool({
        description: "Search configured business knowledge.",
        inputSchema: toolSchemas.searchKnowledge,
        execute: (input) => executeTool("searchKnowledge", input, ctx),
      });
    if (config.enabledTools.includes("getBusinessInformation"))
      tools.getBusinessInformation = tool({
        description: "Read configured business details.",
        inputSchema: toolSchemas.getBusinessInformation,
        execute: (input) => executeTool("getBusinessInformation", input, ctx),
      });
    if (config.enabledTools.includes("requestHumanHandoff"))
      tools.requestHumanHandoff = tool({
        description:
          "Record a request for human assistance in the inbox. Does not notify anyone.",
        inputSchema: toolSchemas.requestHumanHandoff,
        execute: (input) => executeTool("requestHumanHandoff", input, ctx),
      });
    for (const name of ["captureLead", "requestAppointment"] as const)
      if (config.enabledTools.includes(name))
        tools[name] = tool({
          description: `Prepare ${name === "captureLead" ? "contact" : "appointment request"} form. Visitor must review and explicitly submit the form below. This tool does not save personal information.`,
          inputSchema: z.object({ service: z.string().max(200) }),
          execute: async ({ service }) => ({
            requiresVisitorForm: true,
            form: name,
            service,
            message:
              "Ask the visitor to review and submit the form below. Nothing has been saved.",
          }),
        });
    await event(this.env.DB, "model.attempted", this.name);
    const ai = createAI({ binding: this.env.AI });
    const result = streamText({
      model: ai(config.model),
      system: systemPrompt(config, business, knowledge),
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages.slice(-16)),
        toolCalls: "before-last-2-messages",
      }),
      tools,
      stopWhen: stepCountIs(config.maxToolSteps),
      maxOutputTokens: config.maxOutputTokens,
      maxRetries: 0,
      abortSignal: options?.abortSignal
        ? AbortSignal.any([options.abortSignal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
      onFinish: async (result) => {
        await onFinish(result);
        await recordTokens(
          this.env.DB,
          result.totalUsage.inputTokens,
          result.totalUsage.outputTokens,
        );
        await event(this.env.DB, "model.completed", this.name);
      },
      onError: async () => {
        await event(this.env.DB, "model.failed", this.name);
      },
    });
    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) =>
        part.type === "start"
          ? { createdAt: new Date().toISOString() }
          : undefined,
      onError: () => business.fallback,
    });
  }
}
