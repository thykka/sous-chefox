import { detectRecipe } from "./detectRecipe";
import { locateIngredientList } from "./locateIngredientList";
import { rewriteList } from "./pageRewriter";

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
  const list = locateIngredientList(doc, recipe.ingredients);
  if (!list) return null;

  const revert = rewriteList(list, { scale: 1, metric: settings.metric });
  return {
    // Scaling and live settings arrive with the scaling control and the settings popup.
    setScale() {},
    setSettings() {},
    revert,
  };
}
