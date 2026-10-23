import { detectRecipe } from "./detectRecipe";
import { findInstructionReplacements } from "./instructions";
import { locateList } from "./locateList";
import { lineText, linesOf, rewriteLines } from "./pageRewriter";
import { findReplacements, hasAmount, isMetricRecipe } from "./replacements";
import { createScaleControl, ENGLISH, isValidScale, type Messages, type ScaleControl } from "./scaleControl";
import { selectedLines } from "./selection";
import { parseServings } from "./servings";
import { textLinesOf } from "./visibleText";

export type Settings = { metric: boolean; siteDisabled: boolean };

export interface RecipeController {
  /** Same effect as using the scaling control. */
  setScale(factor: number): void;
  /** Re-renders live, or reverts fully when the site is disabled. */
  setSettings(settings: Settings): void;
  /** Restores every original exactly and removes the control. */
  revert(): void;
}

/** Converts the page's recipe in place, or returns null when the page isn't handled. */
export function attach(doc: Document, settings: Settings, messages: Messages = ENGLISH): RecipeController | null {
  if (settings.siteDisabled) return null;
  const recipe = detectRecipe(doc);
  if (!recipe) return null;
  const list = locateList(doc, recipe.ingredients);
  if (!list || linesOf(list).some(isManaged)) return null;
  const instructions = locateList(doc, recipe.instructions);
  const steps = instructions && !instructions.contains(list) && !list.contains(instructions) ? instructions : null;
  return createController(
    {
      ingredients: linesOf(list),
      steps: steps ? linesOf(steps) : [],
      anchor: list,
      servings: parseServings(recipe.yields),
      metricRecipe: isMetricRecipe(recipe.ingredients),
    },
    settings,
    messages,
  );
}

/**
 * Converts the lines a selection touches, as a manual stand-in for `attach` on pages
 * without structured data. Nothing is remembered. Null when there's nothing in the
 * selection to convert or scale.
 */
export function attachToSelection(
  doc: Document,
  range: Range,
  settings: Settings,
  messages: Messages = ENGLISH,
): RecipeController | null {
  if (settings.siteDisabled || range.collapsed) return null;
  const lines = selectedLines(range);
  if (lines.some(isManaged)) return null;
  const texts = lines.flatMap(textLinesOf).map(lineText);
  if (lines.length === 0 || !texts.some(hasAmount)) return null;
  // A list selected from its first item gets the control above the list, as for `attach`.
  const list = lines[0]!.closest("ul, ol");
  const fromFirstItem =
    list !== null &&
    list.querySelector("li") === lines[0] &&
    lines.every((line) => line.tagName === "LI" && list.contains(line));
  const anchor = fromFirstItem ? list : lines[0]!;
  return createController(
    { ingredients: lines, steps: [], anchor, servings: null, metricRecipe: isMetricRecipe(texts) },
    settings,
    messages,
  );
}

/**
 * What a controller rewrites: the ingredient lines, the instruction steps, where the
 * scaling control goes, the servings at 1× (if known), and whether the ingredients are
 * metric already.
 */
type Target = {
  ingredients: Element[];
  steps: Element[];
  anchor: Element;
  servings: number | null;
  metricRecipe: boolean;
};

const nothing = () => {};

/** Lines a controller looks after, so a selection over them isn't converted twice. */
const managed = new WeakSet<Element>();

/** Whether a line is, holds or lies inside a line a controller looks after. */
function isManaged(line: Element): boolean {
  for (let el: Element | null = line; el; el = el.parentElement) if (managed.has(el)) return true;
  return [...line.querySelectorAll("*")].some((el) => managed.has(el));
}

function createController(target: Target, initial: Settings, messages: Messages): RecipeController {
  let settings = initial;
  // The scale always starts at 1 and is never saved.
  let scale = 1;
  let control: ScaleControl | null = null;
  let revertIngredients = nothing;
  let revertSteps = nothing;
  let reverted = false;
  const lines = [...target.ingredients, ...target.steps];
  for (const line of lines) managed.add(line);

  const renderIngredients = () => {
    // A recipe that's already metric has nothing to convert until it's scaled.
    if (target.metricRecipe && scale === 1) return nothing;
    const options = { scale, metric: settings.metric };
    return rewriteLines(target.ingredients, (line) => findReplacements(line, options));
  };
  // Instructions are only converted: scaling never changes them.
  const renderSteps = () =>
    settings.metric ? rewriteLines(target.steps, (line) => findInstructionReplacements(line)) : nothing;

  /** Re-renders the ingredients at `factor`; false when it isn't a scale to apply. */
  const applyScale = (factor: number): boolean => {
    if (!control || !isValidScale(factor)) return false;
    revertIngredients();
    scale = factor;
    revertIngredients = renderIngredients();
    return true;
  };
  const setScale = (factor: number) => {
    if (applyScale(factor)) control!.show(factor);
  };

  // Always from the originals, never from text already rewritten.
  const render = () => {
    revertIngredients = renderIngredients();
    revertSteps = renderSteps();
  };
  const unrender = () => {
    revertIngredients();
    revertSteps();
    revertIngredients = revertSteps = nothing;
  };

  const mount = () => {
    scale = 1;
    render();
    control = createScaleControl(target.anchor, {
      messages,
      servings: target.servings,
      onScale: applyScale,
      onReset: () => setScale(1),
    });
  };
  const unmount = () => {
    unrender();
    control?.remove();
    control = null;
  };

  if (!settings.siteDisabled) mount();
  return {
    setScale,
    setSettings(next) {
      if (reverted) return;
      const metricChanged = next.metric !== settings.metric;
      settings = next;
      if (next.siteDisabled) {
        unmount();
      } else if (!control) {
        mount();
      } else if (metricChanged) {
        unrender();
        render();
      }
    },
    revert() {
      if (reverted) return;
      reverted = true;
      unmount();
      for (const line of lines) managed.delete(line);
    },
  };
}
