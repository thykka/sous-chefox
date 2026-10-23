// Vite 7 and Vitest 3 fail with obscure errors on older Node, so the scripts check first.
import { readFileSync } from "node:fs";

const required = Number(readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim());
if (Number(process.versions.node.split(".")[0]) < required) {
  console.error(`Node ${required}+ required (see .nvmrc), found ${process.version}: run nvm use`);
  process.exit(1);
}
