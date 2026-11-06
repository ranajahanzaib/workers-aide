import { getAgentByName, routeAgentRequest } from "agents";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import {
  type Action,
  agentSchema,
  businessSchema,
  knowledgeSchema,
} from "../shared/schema";
import {
  agentConfig,
  type Bindings,
  businessConfig,
  consume,
  csvCell,
  equalSecret,
  event,
  hash,
  setting,
  token,
} from "./data";
import { cleanup } from "./maintenance";
import { executeTool } from "./tools";

export { BusinessChat } from "./agent";
export { app };

const app = new Hono<{ Bindings: Bindings }>();
const err = (code: string, message: string, status = 400) =>
  Response.json({ error: { code, message } }, { status });
app.onError((e, c) => {
  if (e instanceof SyntaxError)
    return err("VALIDATION_ERROR", "Malformed JSON.");
  if (e instanceof z.ZodError)
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Check the submitted fields.",
          details: e.issues.map((i) => ({ path: i.path, message: i.message })),
        },
      },
      400,
    );
  console.error(JSON.stringify({ event: "request.failed", type: e.name }));
  return c.json(
    {
      error: {
        code: "UNAVAILABLE",
        message: "The operation failed. Please retry.",
      },
    },
    503,
  );
});
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Cache-Control", "no-store");
  if (!c.res.headers.has("Content-Security-Policy"))
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; frame-ancestors *; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
});
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 16384,
    onError: () => err("TOO_LARGE", "Request exceeds 16 KiB.", 413),
  }),
);
app.use("/api/*", async (c, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
    c.req.header("Origin") !== new URL(c.req.url).origin
  )
    return err("ORIGIN", "Invalid request origin.", 403);
  await next();
});
async function admin(req: Request, env: Bindings) {
  if (!env.ADMIN_SECRET || env.ADMIN_SECRET.length < 32) return false;
  const raw = req.headers
    .get("Cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("aide_session="))
    ?.slice(13);
  if (!raw) return false;
  return !!(await env.DB.prepare(
    "SELECT hash FROM sessions WHERE hash=? AND secret_hash=? AND expires>?",
  )
    .bind(await hash(raw), await hash(env.ADMIN_SECRET), Date.now())
    .first());
}
async function visitor(req: Request, env: Bindings, id: string) {
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!bearer) return false;
  return !!(await env.DB.prepare(
    "SELECT id FROM conversations WHERE id=? AND token_hash=? AND expires>?",
  )
    .bind(id, await hash(bearer), Date.now())
    .first());
}
app.post("/api/auth/login", async (c) => {
  if (!c.env.ADMIN_SECRET || c.env.ADMIN_SECRET.length < 32)
    return err(
      "NOT_CONFIGURED",
      "Set ADMIN_SECRET to at least 32 random characters.",
      503,
    );
  const ip = await hash(c.req.header("CF-Connecting-IP") ?? "local");
  if (!(await consume(c.env.DB, `login:${ip}`, 5, 900)))
    return err("RATE_LIMIT", "Try again in 15 minutes.", 429);
  const { secret } = z
    .object({ secret: z.string().max(512) })
    .parse(await c.req.json());
  if (!(await equalSecret(secret, c.env.ADMIN_SECRET)))
    return err("UNAUTHORIZED", "Invalid access secret.", 401);
  const raw = token();
  await c.env.DB.prepare("INSERT INTO sessions VALUES(?,?,?)")
    .bind(
      await hash(raw),
      await hash(c.env.ADMIN_SECRET),
      Date.now() + 8 * 3600000,
    )
    .run();
  setCookie(c, "aide_session", raw, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: 28800,
  });
  return c.json({ ok: true });
});
app.get("/api/auth/session", async (c) =>
  c.json({ authenticated: await admin(c.req.raw, c.env) }),
);
app.post("/api/auth/logout", async (c) => {
  const raw = getCookie(c, "aide_session");
  if (raw)
    await c.env.DB.prepare("DELETE FROM sessions WHERE hash=?")
      .bind(await hash(raw))
      .run();
  deleteCookie(c, "aide_session", { path: "/" });
  return c.json({ ok: true });
});
app.get("/api/widget/config", async (c) => {
  const [b, a] = await Promise.all([
    businessConfig(c.env.DB),
    agentConfig(c.env.DB),
  ]);
  return c.json({
    name: a.name,
    welcomeMessage: a.welcomeMessage,
    enabled: a.enabled,
    color: b.widgetColor,
    position: b.widgetPosition,
    theme: b.widgetTheme,
    fallback: b.fallback,
    email: b.email,
    phone: b.phone,
  });
});
app.post("/api/public/conversations", async (c) => {
  const a = await agentConfig(c.env.DB);
  if (!a.enabled)
    return err("UNPUBLISHED", "This assistant is not published.", 403);
  const ip = await hash(c.req.header("CF-Connecting-IP") ?? "local");
  if (
    !(await consume(c.env.DB, `new:${ip}`, 10)) ||
    !(await consume(c.env.DB, "conversations:daily", 200))
  )
    return err("RATE_LIMIT", "Conversation limit reached.", 429);
  const id = crypto.randomUUID(),
    raw = token(),
    b = await businessConfig(c.env.DB);
  await c.env.DB.prepare(
    "INSERT INTO conversations(id,agent_id,token_hash,expires) VALUES(?,?,?,?)",
  )
    .bind(id, a.id, await hash(raw), Date.now() + b.retentionDays * 86400000)
    .run();
  await event(c.env.DB, "conversation.started", id);
  return c.json({ id, token: raw }, 201);
});
app.use("/api/public/conversations/:id/*", async (c, next) => {
  if (!(await visitor(c.req.raw, c.env, c.req.param("id") ?? "")))
    return err("UNAUTHORIZED", "Conversation credential required.", 401);
  await next();
});
app.post("/api/public/conversations/:id/ticket", async (c) => {
  if (!(await consume(c.env.DB, `ticket-issue:${c.req.param("id")}`, 30, 300)))
    return err("RATE_LIMIT", "Too many reconnections. Try again shortly.", 429);
  const raw = token();
  await c.env.DB.prepare(
    "INSERT INTO counters(key,value,expires) VALUES(?,0,?)",
  )
    .bind(
      `ticket:${await hash(raw)}:${c.req.param("id")}`,
      Math.floor(Date.now() / 1000) + 120,
    )
    .run();
  return c.json({ ticket: raw });
});
app.post("/api/public/conversations/:id/actions/:tool", async (c) => {
  const name = z
    .enum(["captureLead", "requestAppointment", "requestHumanHandoff"])
    .parse(c.req.param("tool"));
  try {
    return c.json(
      await executeTool(name, await c.req.json(), {
        db: c.env.DB,
        conversationId: c.req.param("id"),
        agentId: "default",
        visitorConfirmed: true,
      }),
    );
  } catch (e) {
    return err(
      "ACTION_REJECTED",
      e instanceof Error ? e.message : "Action failed",
    );
  }
});
app.use("/api/*", async (c, next) => {
  if (
    c.req.path.startsWith("/api/public/") ||
    c.req.path.startsWith("/api/auth/") ||
    c.req.path === "/api/widget/config"
  )
    return next();
  if (!(await admin(c.req.raw, c.env)))
    return err("UNAUTHORIZED", "Administrator session required.", 401);
  await next();
});
for (const name of ["business", "agent"] as const) {
  const path = name === "agent" ? "/api/agents/default" : "/api/business";
  app.get(path, async (c) => c.json(await setting(c.env.DB, name)));
  app.patch(path, async (c) => {
    const data = (name === "agent" ? agentSchema : businessSchema).parse(
      await c.req.json(),
    );
    await c.env.DB.prepare("UPDATE settings SET value=? WHERE id=?")
      .bind(JSON.stringify(data), name)
      .run();
    await event(c.env.DB, "configuration.changed");
    return c.json(data);
  });
}
app.get("/api/agents", async (c) => c.json([await agentConfig(c.env.DB)]));
app.get("/api/knowledge", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT * FROM knowledge ORDER BY updated_at DESC LIMIT 200",
      ).all()
    ).results,
  ),
);
app.post("/api/knowledge", async (c) => {
  const v = knowledgeSchema.parse(await c.req.json());
  const id = crypto.randomUUID();
  const count = await c.env.DB.prepare(
    "SELECT count(*) AS n FROM knowledge",
  ).first<{ n: number }>();
  if ((count?.n ?? 0) >= 200)
    return err("LIMIT", "Maximum 200 knowledge entries.");
  const inserted = await c.env.DB.prepare(
    "INSERT INTO knowledge(id,title,content,category,enabled) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM knowledge)<200",
  )
    .bind(id, v.title, v.content, v.category, Number(v.enabled))
    .run();
  if (!inserted.meta.changes)
    return err("LIMIT", "Maximum 200 knowledge entries.");
  return c.json({ id, ...v }, 201);
});
app.patch("/api/knowledge/:id", async (c) => {
  const v = knowledgeSchema.parse(await c.req.json());
  await c.env.DB.prepare(
    "UPDATE knowledge SET title=?,content=?,category=?,enabled=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",
  )
    .bind(v.title, v.content, v.category, Number(v.enabled), c.req.param("id"))
    .run();
  return c.json({ ok: true });
});
app.delete("/api/knowledge/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM knowledge WHERE id=?")
    .bind(c.req.param("id"))
    .run();
  return c.json({ ok: true });
});
app.get("/api/conversations", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT id,agent_id,status,created_at,expires FROM conversations ORDER BY created_at DESC LIMIT 200",
      ).all()
    ).results,
  ),
);
app.get("/api/conversations/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT id FROM conversations WHERE id=?")
    .bind(c.req.param("id"))
    .first();
  if (!row) return err("NOT_FOUND", "Conversation not found.", 404);
  const agent = await getAgentByName(c.env.BusinessChat, c.req.param("id"));
  const actions = await c.env.DB.prepare(
    "SELECT * FROM actions WHERE conversation_id=? ORDER BY created_at",
  )
    .bind(c.req.param("id"))
    .all();
  return c.json({
    messages: await agent.transcript(),
    actions: actions.results,
  });
});
app.patch("/api/conversations/:id", async (c) => {
  const { status } = z
    .object({ status: z.enum(["open", "needs_attention", "resolved"]) })
    .parse(await c.req.json());
  await c.env.DB.prepare("UPDATE conversations SET status=? WHERE id=?")
    .bind(status, c.req.param("id"))
    .run();
  return c.json({ ok: true });
});
app.delete("/api/conversations/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM conversations WHERE id=?").bind(id).run();
  const agent = await getAgentByName(c.env.BusinessChat, id);
  await agent.erase();
  return c.json({ ok: true });
});
app.get("/api/leads/export", async (c) => {
  const rows = (
    await c.env.DB.prepare(
      "SELECT * FROM actions WHERE tool='captureLead' ORDER BY created_at DESC LIMIT 10000",
    ).all<Action>()
  ).results;
  return new Response(
    [
      "name,email,phone,service,message,status,created_at",
      ...rows.map((r) => {
        const v = JSON.parse(r.input);
        return [
          v.name,
          v.email,
          v.phone,
          v.service,
          v.message,
          r.status,
          r.created_at,
        ]
          .map(csvCell)
          .join(",");
      }),
    ].join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="leads.csv"',
      },
    },
  );
});
for (const [path, tool] of [
  ["leads", "captureLead"],
  ["appointments", "requestAppointment"],
] as const) {
  app.get(`/api/${path}`, async (c) =>
    c.json(
      (
        await c.env.DB.prepare(
          "SELECT * FROM actions WHERE tool=? ORDER BY created_at DESC LIMIT 200",
        )
          .bind(tool)
          .all()
      ).results,
    ),
  );
  app.patch(`/api/${path}/:id`, async (c) => {
    const { status } = z
      .object({
        status:
          path === "leads"
            ? z.enum(["new", "contacted", "qualified", "closed"])
            : z.enum(["pending", "confirmed", "declined", "cancelled"]),
      })
      .parse(await c.req.json());
    await c.env.DB.prepare("UPDATE actions SET status=? WHERE id=? AND tool=?")
      .bind(status, c.req.param("id"), tool)
      .run();
    return c.json({ ok: true });
  });
  app.delete(`/api/${path}/:id`, async (c) => {
    await c.env.DB.prepare("DELETE FROM actions WHERE id=? AND tool=?")
      .bind(c.req.param("id"), tool)
      .run();
    return c.json({ ok: true });
  });
}
app.get("/api/usage", async (c) => {
  const [counts, events, counters, totals] = await Promise.all([
    c.env.DB.prepare(
      "SELECT (SELECT count(*) FROM conversations) conversations,(SELECT count(*) FROM actions WHERE tool='captureLead') leads,(SELECT count(*) FROM actions WHERE tool='requestAppointment' AND status='pending') appointments,(SELECT count(*) FROM conversations WHERE status='needs_attention') attention",
    ).first(),
    c.env.DB.prepare(
      "SELECT event,created_at FROM events ORDER BY created_at DESC LIMIT 30",
    ).all(),
    c.env.DB.prepare(
      "SELECT key,value,expires FROM counters WHERE expires>? AND (key LIKE ? OR key LIKE ? OR key LIKE ?)",
    )
      .bind(Math.floor(Date.now() / 1000), "ai:%", "messages:%", "tokens:%")
      .all(),
    c.env.DB.prepare(
      "SELECT event,count(*) AS count FROM events GROUP BY event ORDER BY event",
    ).all(),
  ]);
  return c.json({
    counts,
    events: events.results,
    counters: counters.results,
    totals: totals.results,
  });
});
app.all("/api/*", () => err("NOT_FOUND", "Unknown API route.", 404));
app.get("*", async (c) => {
  const response = await c.env.ASSETS.fetch(c.req.raw);
  const headers = new Headers(response.headers);
  const b =
    c.req.path === "/widget" ? await businessConfig(c.env.DB) : undefined;
  const ancestors =
    c.req.path === "/widget"
      ? b?.allowedOrigins.length
        ? [new URL(c.req.url).origin, ...b.allowedOrigins].join(" ")
        : "*"
      : "'self'";
  headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; frame-src 'self'; frame-ancestors ${ancestors}; base-uri 'self'; form-action 'self'; object-src 'none'`,
  );
  return new Response(response.body, { status: response.status, headers });
});
export default {
  async scheduled(
    _event: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(cleanup(env));
  },
  async fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/agents/")) {
      const check = async (
        r: Request,
        route: { name: string; className: string },
      ) => {
        if (route.className !== "BusinessChat")
          return err("NOT_FOUND", "Unknown agent.", 404);
        const origin = r.headers.get("Origin");
        if (origin && origin !== url.origin)
          return err("ORIGIN", "Invalid connection origin.", 403);
        const ticket = new URL(r.url).searchParams.get("ticket");
        if (!ticket)
          return err("UNAUTHORIZED", "Connection ticket required.", 401);
        const valid = await env.DB.prepare(
          "SELECT key FROM counters WHERE key=? AND expires>?",
        )
          .bind(
            `ticket:${await hash(ticket)}:${route.name}`,
            Math.floor(Date.now() / 1000),
          )
          .first();
        const row = await env.DB.prepare(
          "SELECT id FROM conversations WHERE id=? AND expires>?",
        )
          .bind(route.name, Date.now())
          .first();
        if (!valid || !row)
          return err(
            "UNAUTHORIZED",
            "Connection expired. Reconnect to continue.",
            401,
          );
        return undefined;
      };
      return (
        (await routeAgentRequest(req, env, {
          onBeforeConnect: check,
          onBeforeRequest: check,
        })) ?? err("NOT_FOUND", "Unknown agent.", 404)
      );
    }
    return app.fetch(req, env, ctx);
  },
} satisfies ExportedHandler<Bindings>;
