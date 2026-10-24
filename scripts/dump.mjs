// Shows what `attach` does to a saved page: the list it locates, every ingredient line
// before and after, the instruction steps it changes, and the ingredients scaled.
//
//   npm run dump -- <fixture name or path> [--scale <factor>] [--imperial] [--ml] [--fractions] [--outline]
//
// --outline shows instead what a hand-written fixture needs to copy from a captured page:
// the recipe data, and the markup around and inside the ingredient list and the steps.
//
// Like the extension it writes volumes in dl, rkl and tl and amounts as decimals, unless
// --ml or --fractions says otherwise.
//
// The output is a draft to check by hand against the page: expectations in tests are
// worked out from the recipe, never pasted from here unchecked.
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { JSDOM, VirtualConsole } from "jsdom";
import { createServer } from "vite";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scale: { type: "string", default: "2" },
    imperial: { type: "boolean" },
    ml: { type: "boolean" },
    fractions: { type: "boolean" },
    outline: { type: "boolean" },
  },
});
const [page] = positionals;
if (!page) {
  console.error("Usage: npm run dump -- <fixture name or path> [--scale <factor>] [--imperial] [--ml] [--fractions] [--outline]");
  process.exit(1);
}
const fixture = new URL(`../test/fixtures/${page.replace(/\.html$/, "")}.html`, import.meta.url);
const html = readFileSync(existsSync(page) ? page : fixture, "utf8");
// The core reads these as globals, as it does in the browser and in Vitest's jsdom. Pages
// are parsed in the same window, or `instanceof Element` fails across the two.
const { window } = new JSDOM("", { virtualConsole: new VirtualConsole() });
Object.assign(globalThis, { Node: window.Node, NodeFilter: window.NodeFilter, Element: window.Element });
const load = () => new window.DOMParser().parseFromString(html, "text/html");

const vite = await createServer({
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
});
try {
  const { attach } = await vite.ssrLoadModule("/src/core/attach.ts");
  const { detectRecipe } = await vite.ssrLoadModule("/src/core/detectRecipe.ts");
  const { locateList } = await vite.ssrLoadModule("/src/core/locateList.ts");
  const { linesOf, lineText } = await vite.ssrLoadModule("/src/core/pageRewriter.ts");
  const { textLinesOf } = await vite.ssrLoadModule("/src/core/visibleText.ts");
  // A line as the rewriter reads it: cells and blocks apart, as on the page.
  const read = (line) => textLinesOf(line).map(lineText).join(" ").replace(/\s+/g, " ");
  (values.outline ? outline : dump)({ attach, detectRecipe, locateList, linesOf, read });
} finally {
  await vite.close();
}

function dump({ attach, detectRecipe, locateList, linesOf, read }) {
  const doc = load();
  const recipe = detectRecipe(doc);
  if (!recipe) return console.log("No recipe data: attach leaves the page alone.");
  console.log(`Recipe data: ${recipe.ingredients.length} ingredients, ${recipe.instructions.length} steps, yield ${JSON.stringify(recipe.yields)}`);

  // Located before attach changes anything, and found again by selector afterwards.
  const original = load();
  const stepsList = locateList(original, recipe.instructions);
  const stepsSelector = stepsList && selectorFor(stepsList);
  const stepsBefore = stepsList ? linesOf(stepsList).map((line) => read(line).trim()) : [];

  const controller = attach(doc, { metric: !values.imperial, kitchen: !values.ml, decimals: !values.fractions, siteDisabled: false });
  if (!controller) return console.log("No ingredient list located confidently: attach leaves the page alone.");

  const list = doc.querySelector("sous-chefox-scale").nextElementSibling;
  const lines = linesOf(list);
  const before = linesOf(original.querySelector(selectorFor(list))).map(read);
  console.log(`\nIngredient list: ${selectorFor(list)} (each line a ${describe(lines[0])})`);
  lines.forEach((line, i) => {
    const after = read(line);
    console.log(after === before[i] ? `  = ${q(after)}` : `  ${q(before[i])}\n    → ${q(after)}`);
  });

  if (!stepsSelector) {
    console.log("\nNo instruction steps located.");
  } else {
    const steps = linesOf(doc.querySelector(stepsSelector));
    console.log(`\nSteps: ${stepsSelector} (each step a ${describe(steps[0])}), changed by index:`);
    const changed = steps.map((step, i) => [i, read(step).trim()]).filter(([i, text]) => text !== stepsBefore[i]);
    if (changed.length === 0) console.log("  none");
    for (const [i, text] of changed) console.log(`  ${i}: ${q(text)}`);
    for (const mark of doc.querySelectorAll(`${stepsSelector} .sous-chefox-converted`)) {
      console.log(`    ${q(mark.textContent)} ← ${q(mark.getAttribute("title"))}`);
    }
  }

  const scale = Number(values.scale);
  controller.setScale(scale);
  console.log(`\nIngredients at ${scale}×:`);
  for (const line of lines) console.log(`  ${q(read(line))}`);
}

function outline({ detectRecipe, locateList, linesOf }) {
  const doc = load();
  const recipe = detectRecipe(doc);
  if (!recipe) return console.log("No recipe data.");
  console.log(`Recipe data: yield ${JSON.stringify(recipe.yields)}`);
  console.log(`  ingredients: ${JSON.stringify(recipe.ingredients)}`);
  console.log(`  steps: ${recipe.instructions.length}`);
  for (const [name, lines] of [["Ingredient list", recipe.ingredients], ["Steps", recipe.instructions]]) {
    const list = locateList(doc, lines);
    if (!list) {
      console.log(`\n${name}: not located`);
      continue;
    }
    const chain = [];
    for (let el = list; el && el !== doc.body; el = el.parentElement) chain.push(own(el));
    console.log(`\n${name}: ${chain.reverse().join(" > ")}`);
    console.log(`  ${linesOf(list).length} lines; the first two:`);
    for (const line of linesOf(list).slice(0, 2)) console.log(`  ${line.outerHTML.replace(/\s+/g, " ")}`);
  }
}

function own(el) {
  return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + [...el.classList].map((c) => `.${c}`).join("");
}

/** A line's tag and classes, as in "li.wprm-recipe-ingredient". */
function describe(el) {
  return el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join("");
}

/** A selector that matches only `el`, as short as the page allows. */
function selectorFor(el) {
  const own = (node) =>
    node.id ? `#${CSS_escape(node.id)}` : node.tagName.toLowerCase() + [...node.classList].map((c) => `.${CSS_escape(c)}`).join("");
  let selector = own(el);
  for (let parent = el.parentElement; parent && el.ownerDocument.querySelectorAll(selector).length > 1; parent = parent.parentElement) {
    selector = `${own(parent)} ${selector}`;
  }
  return selector;
}

function CSS_escape(ident) {
  return ident.replace(/([^\w-])/g, "\\$1");
}

function q(text) {
  return JSON.stringify(text.trim());
}
