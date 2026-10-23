// Vite 7 and Vitest 3 fail with obscure errors on older Node, and .nvmrc pins a
// security release, so the scripts check the full version first.
import { readFileSync } from "node:fs";

const required = readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim();
const parts = (version) => version.replace(/^v/, "").split(".").map(Number);
const [want, have] = [parts(required), parts(process.version)];
const firstDifference = want.findIndex((part, i) => have[i] !== part);
if (firstDifference !== -1 && have[firstDifference] < want[firstDifference]) {
  console.error(`Node ${required}+ required (see .nvmrc), found ${process.version}: run nvm use`);
  process.exit(1);
}
