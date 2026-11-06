import { copyFileSync } from "node:fs";

copyFileSync("packages/widget/src/widget.js", "apps/platform/public/widget.js");
