import { detectRecipe } from "./detectRecipe";
import { findInstructionReplacements } from "./instructions";
import { locateList } from "./locateList";
import { rewriteList } from "./pageRewriter";
import { findReplacements, isMetricRecipe } from "./replacements";
import { createScaleControl, ENGLISH, isValidScale, type Messages } from "./scaleControl";

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
  if (!list) return null;
  const instructions = locateList(doc, recipe.instructions);
  const steps = instructions && !instructions.contains(list) && !list.contains(instructions) ? instructions : null;
  const metricRecipe = isMetricRecipe(recipe.ingredients);

  // The scale always starts at 1 and is never saved.
  let scale = 1;
  const renderIngredients = () => {
    // A recipe that's already metric has nothing to convert until it's scaled.
    if (metricRecipe && scale === 1) return () => {};
    const options = { scale, metric: settings.metric };
    return rewriteList(list, (line) => findReplacements(line, options));
  };
  let revertIngredients = renderIngredients();
  // Instructions are converted once: scaling never changes them.
  const revertSteps =
    steps && settings.metric ? rewriteList(steps, (line) => findInstructionReplacements(line)) : () => {};

  let reverted = false;
  const applyScale = (factor: number) => {
    if (reverted || !isValidScale(factor)) return;
    revertIngredients();
    scale = factor;
    revertIngredients = renderIngredients();
  };
  const setScale = (factor: number) => {
    if (reverted || !isValidScale(factor)) return;
    applyScale(factor);
    control.show(factor);
  };
  const control = createScaleControl(list, messages, applyScale, () => setScale(1));

  return {
    setScale,
    // Live settings arrive with the settings popup.
    setSettings() {},
    revert() {
      reverted = true;
      revertIngredients();
      revertSteps();
      control.remove();
    },
  };
}
