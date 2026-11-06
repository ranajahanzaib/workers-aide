import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (Number(process.versions.node.split(".")[0]) < 22)
  throw new Error("Node 22 or newer is required.");
const path = "apps/platform/.dev.vars";
if (!existsSync(path))
  writeFileSync(path, `ADMIN_SECRET=${randomBytes(32).toString("hex")}\n`, {
    mode: 0o600,
  });
console.log(
  "Local admin secret is in apps/platform/.dev.vars (not printed). Keep it private.",
);
const result = spawnSync("pnpm", ["db:migrate"], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  "Local D1 is ready. Run pnpm dev. AI inference uses Cloudflare remotely and requires wrangler login. Without it, contact forms still work.",
);
