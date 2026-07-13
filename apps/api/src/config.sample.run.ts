import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEnvSample } from "./config.sample";

const out = join(process.cwd(), ".env.example");
writeFileSync(out, buildEnvSample());
// eslint-disable-next-line no-console
console.log(`Wrote ${out}`);
