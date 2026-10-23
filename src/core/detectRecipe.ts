export type RecipeData = { ingredients: string[]; yield: string | null };

/** Reads schema.org Recipe data (JSON-LD first, then microdata), or null when there is none. */
export function detectRecipe(doc: Document): RecipeData | null {
  return fromJsonLd(doc) ?? fromMicrodata(doc);
}

function fromJsonLd(doc: Document): RecipeData | null {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? "");
    } catch {
      continue;
    }
    const recipe = findRecipeNode(data);
    if (recipe) {
      return {
        ingredients: toStrings(recipe.recipeIngredient ?? recipe.ingredients),
        yield: toStrings(recipe.recipeYield)[0] ?? null,
      };
    }
  }
  return null;
}

function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipeNode(child);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object" || node === null) return null;
  const record = node as Record<string, unknown>;
  if (toStrings(record["@type"]).includes("Recipe")) return record;
  return findRecipeNode(record["@graph"]);
}

function toStrings(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
    .map((v) => String(v).trim());
}

function fromMicrodata(doc: Document): RecipeData | null {
  const scope = doc.querySelector('[itemscope][itemtype*="schema.org/Recipe" i]');
  if (!scope) return null;
  const ingredients = [...scope.querySelectorAll('[itemprop~="recipeIngredient"], [itemprop~="ingredients"]')];
  const yieldEl = scope.querySelector('[itemprop~="recipeYield"]');
  return {
    ingredients: ingredients.map((el) => itempropValue(el)),
    yield: yieldEl ? itempropValue(yieldEl) : null,
  };
}

function itempropValue(el: Element): string {
  return (el.getAttribute("content") ?? el.textContent ?? "").trim();
}
