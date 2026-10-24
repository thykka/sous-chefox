// Saves a real recipe page, trimmed, to .scratch/pages/ for study: never into the
// repository, since the page is someone else's work. A test fixture is written by hand
// from what `npm run dump -- .scratch/pages/<name>.html --outline` shows of its structure.
//
//   npm run capture -- <url> <name> [--from <saved.html>] [--drop <selector>] [--cut <selector>:<n>] [--force]
//
// --from trims a page saved from the browser instead of fetching it (many recipe sites
// refuse scripted requests). --drop removes more elements, --cut keeps only the first n
// children of an element.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { JSDOM, VirtualConsole } from "jsdom";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    from: { type: "string" },
    drop: { type: "string" },
    cut: { type: "string" },
    force: { type: "boolean" },
  },
});
const [url, name] = positionals;
if (!url || !name) {
  console.error("Usage: npm run capture -- <url> <name> [--from <saved.html>] [--drop <selector>] [--cut <selector>:<n>] [--force]");
  process.exit(1);
}
const dir = new URL("../.scratch/pages/", import.meta.url);
mkdirSync(dir, { recursive: true });
const out = new URL(`${name}.html`, dir);
if (existsSync(out) && !values.force) {
  console.error(`.scratch/pages/${name}.html exists; pass --force to replace it.`);
  process.exit(1);
}

const html = values.from ? readFileSync(values.from, "utf8") : await download(url);
// A silent console: real pages are full of CSS jsdom can't parse, and none of it matters here.
const doc = new JSDOM(html, { virtualConsole: new VirtualConsole() }).window.document;
// The canonical URL names the recipe even when the given one redirected elsewhere.
const source = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || url;

// <aside> stays: some sites (King Arthur) put the ingredient list in one.
const DROP =
  "script:not([type='application/ld+json']), style, link, meta:not([charset]), noscript, iframe, svg, img, picture, source, video, audio, canvas, template, form, input, select, textarea, button, header, footer, nav, dialog";
const KEEP_ATTRIBUTES = new Set(["class", "id", "itemprop", "itemscope", "itemtype", "content", "lang", "charset", "type", "name", "href"]);

doc.querySelectorAll(DROP).forEach((el) => el.remove());
if (values.drop) doc.querySelectorAll(values.drop).forEach((el) => el.remove());
let cutNote = "";
if (values.cut) {
  const [selector, count] = values.cut.split(/:(?=\d+$)/);
  const parent = doc.querySelector(selector);
  if (!parent) throw new Error(`--cut: nothing matches ${selector}`);
  [...parent.children].slice(Number(count)).forEach((el) => el.remove());
  cutNote = `, and ${selector} was cut after its first ${count} children`;
}
// JSON-LD without a Recipe is site metadata the tests never read.
for (const script of doc.querySelectorAll("script")) if (!script.textContent.includes("Recipe")) script.remove();
const comments = doc.createTreeWalker(doc, doc.defaultView.NodeFilter.SHOW_COMMENT);
const found = [];
while (comments.nextNode()) found.push(comments.currentNode);
found.forEach((comment) => comment.remove());
for (const el of doc.querySelectorAll("*")) {
  for (const { name: attribute } of [...el.attributes]) if (!KEEP_ATTRIBUTES.has(attribute)) el.removeAttribute(attribute);
  const href = el.getAttribute("href");
  if (href) el.setAttribute("href", href.replace(/[?#].*$/, ""));
}
// Repeatedly, so wrappers emptied by the removals go too.
for (let removed = true; removed; ) {
  removed = false;
  for (const el of doc.body.querySelectorAll("*")) {
    if (el.tagName === "BR" || el.tagName === "HR" || el.hasAttribute("itemprop")) continue;
    if (el.children.length === 0 && !el.textContent.trim()) {
      el.remove();
      removed = true;
    }
  }
}

// The local date as YYYY-MM-DD, as the Swedish locale writes it.
const today = new Date().toLocaleDateString("sv");
const dropNote = values.drop ? ` (also ${values.drop})` : "";
const fixture = `<!DOCTYPE html>
<!--
  Saved from ${source} on ${today}.
  Trimmed for size: scripts (other than recipe JSON-LD), styles, images, forms, buttons,
  headers, footers, navigation, comments, empty elements, attributes other than
  class, id, microdata and links, and query strings were removed${dropNote}${cutNote}.
  The remaining markup is kept as served.
-->
${doc.documentElement.outerHTML}
`;
writeFileSync(out, fixture);

const kb = Math.round(fixture.length / 1024);
console.log(`Wrote .scratch/pages/${name}.html (${kb} KB), which git ignores.`);
if (!doc.querySelector('script[type="application/ld+json"]')) console.log("No Recipe JSON-LD kept: fine for a page that isn't a recipe.");
console.log(`Next: npm run dump -- .scratch/pages/${name}.html --outline`);

async function download(address) {
  // NODE_USE_ENV_PROXY (set by the npm script) makes fetch use HTTPS_PROXY, as curl does.
  const response = await fetch(address, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.5",
    },
  }).catch((error) => {
    console.error(`Couldn't fetch ${address}: ${error.cause?.message ?? error.message}`);
    process.exit(1);
  });
  if (!response.ok) {
    console.error(`${address} answered ${response.status}. Save the page from Firefox and pass it with --from.`);
    process.exit(1);
  }
  return response.text();
}
