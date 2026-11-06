import { z } from "zod";
export const MODEL = "@cf/zai-org/glm-4.7-flash" as const;
export const toolNames = [
  "searchKnowledge",
  "getBusinessInformation",
  "captureLead",
  "requestAppointment",
  "requestHumanHandoff",
] as const;
const text = (max = 1000) => z.string().trim().max(max);
export const businessSchema = z.object({
  name: text(100).min(1),
  description: text(2000),
  industry: text(100),
  email: z.union([z.email(), z.literal("")]),
  phone: text(80),
  address: text(),
  hours: text(),
  services: text(2000),
  website: z.union([z.url().refine((v) => /^https?:/.test(v)), z.literal("")]),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }),
  retentionDays: z.number().int().min(1).max(365),
  fallback: text(500).min(1),
  widgetColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  widgetPosition: z.enum(["left", "right"]),
  widgetTheme: z.enum(["light", "dark"]),
  allowedOrigins: z
    .array(z.url().refine((v) => new URL(v).origin === v))
    .max(20),
});
export const agentSchema = z.object({
  id: z.literal("default"),
  name: text(100).min(1),
  description: text(500),
  enabled: z.boolean(),
  template: z.enum([
    "general",
    "support",
    "lead-qualification",
    "appointments",
  ]),
  instructions: text(4000),
  welcomeMessage: text(500).min(1),
  enabledTools: z.array(z.enum(toolNames)).max(5),
  model: z.literal(MODEL),
  maxOutputTokens: z.number().int().min(128).max(1024),
  maxToolSteps: z.number().int().min(1).max(4),
  dailyAIRequests: z.number().int().min(1).max(1000),
  maxMessages: z.number().int().min(2).max(80),
});
export const knowledgeSchema = z.object({
  title: text(160).min(1),
  content: text(6000).min(1),
  category: z.enum([
    "faq",
    "business",
    "service",
    "pricing",
    "hours",
    "contact",
    "policy",
    "note",
  ]),
  enabled: z.boolean(),
});
export const contactSchema = z.object({
  name: text(100).min(1),
  email: z.email().max(254),
  phone: text(80).default(""),
  service: text(200).min(1),
  message: text(2000).default(""),
  consent: z.literal(true),
});
export const appointmentSchema = contactSchema.extend({
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export type Business = z.infer<typeof businessSchema>;
export type AgentConfig = z.infer<typeof agentSchema>;
export type ToolName = (typeof toolNames)[number];
export type Action = {
  id: string;
  conversation_id: string;
  tool: ToolName;
  input: string;
  status: string;
  created_at: string;
};
export type Conversation = {
  id: string;
  agent_id: string;
  status: string;
  created_at: string;
  expires: number;
};
export type Knowledge = z.infer<typeof knowledgeSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};
export const templates = {
  general: "Answer business questions and guide visitors to relevant actions.",
  support:
    "Use policies and knowledge to resolve questions. Offer human handoff for unresolved issues.",
  "lead-qualification":
    "Understand needs and interested service. Offer the contact form; never collect details without consent.",
  appointments:
    "Explain services and collect appointment preferences using the request form. Never invent availability or confirm bookings.",
};
