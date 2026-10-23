import { detectRecipe } from "./detectRecipe";
import { findInstructionReplacements } from "./instructions";
import { locateList } from "./locateList";
import { rewriteList } from "./pageRewriter";
import { findReplacements, isMetricRecipe } from "./replacements";

export type Settings = { metric: boolean; siteDisabled: boolean };

export interface RecipeController {
  /** Same effect as using the scaling control. */
  setScale(factor: number): void;
  /** Re-renders live, or reverts fully when the site is disabled. */
  setSettings(settings: Settings): void;
  /** Restores every original exactly. */
  revert(): void;
}

/** Converts the page's recipe in place, or returns null when the page isn't handled. */
export function attach(doc: Document, settings: Settings): RecipeController | null {
  if (settings.siteDisabled) return null;
  const recipe = detectRecipe(doc);
  if (!recipe) return null;
  const list = locateList(doc, recipe.ingredients);
  if (!list) return null;
  const instructions = locateList(doc, recipe.instructions);
  const steps = instructions && !instructions.contains(list) && !list.contains(instructions) ? instructions : null;

  const options = { scale: 1, metric: settings.metric };
  // A recipe that's already metric has nothing to convert until it's scaled.
  const revertIngredients = isMetricRecipe(recipe.ingredients)
    ? () => {}
    : rewriteList(list, (line) => findReplacements(line, options));
  const revertSteps =
    steps && settings.metric ? rewriteList(steps, (line) => findInstructionReplacements(line)) : () => {};
  return {
    // Scaling and live settings arrive with the scaling control and the settings popup.
    setScale() {},
    setSettings() {},
    revert() {
      revertIngredients();
      revertSteps();
    },
  };
}
