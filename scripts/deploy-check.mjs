import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("apps/platform/wrangler.jsonc", "utf8"));
const database = config.d1_databases?.find((d) => d.binding === "DB");
if (!database?.database_id || /^0{8}-/.test(database.database_id))
  throw new Error(
    "Provision D1 and replace the placeholder database_id. See docs/deployment.md.",
  );
if (
  !config.ai?.binding ||
  !config.durable_objects?.bindings?.some(
    (b) => b.class_name === "BusinessChat",
  ) ||
  !existsSync("apps/platform/migrations/0001_initial.sql")
)
  throw new Error("Missing required bindings or migrations.");
const child = spawnSync(
  "pnpm",
  ["--filter", "@aide/platform", "exec", "wrangler", "secret", "list"],
  { encoding: "utf8" },
);
if (child.status !== 0)
  throw new Error(
    "Cannot inspect remote secret names. Run wrangler login first.",
  );
if (!child.stdout.includes("ADMIN_SECRET"))
  throw new Error("Set the remote ADMIN_SECRET before deploying.");
console.log(
  "Bindings, migration file, D1 ID and remote admin secret name are configured. Run pnpm run deploy for tests, build and deployment.",
);
