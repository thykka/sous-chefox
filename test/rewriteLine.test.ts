import { describe, expect, it } from "vitest";
import { rewriteLine } from "../src/core/rewriteLine";

const metric = { scale: 1, metric: true, locale: "en-US" };

describe("rewriteLine", () => {
  it.each([
    ["1 cup milk", "240 ml milk"],
    ["2 tbsp olive oil", "30 ml olive oil"],
    ["1 tsp vanilla extract", "5 ml vanilla extract"],
    ["2 teaspoons baking powder", "10 ml baking powder"],
    ["1 tablespoon honey", "15 ml honey"],
    ["Butter, 2 tbsp", "Butter, 30 ml"],
    ["4 cups water - divided", "950 ml water - divided"],
  ])("%s → %s", (line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });
});

describe("rewriteLine parses every way of writing an amount", () => {
  it.each([
    ["ascii fraction", "1/2 cup sugar", "120 ml sugar"],
    ["fraction slash", "1⁄2 cup sugar", "120 ml sugar"],
    ["unicode fraction", "½ cup sugar", "120 ml sugar"],
    ["mixed number", "1 1/2 cups flour", "350 ml flour"],
    ["mixed number with hyphen", "1-1/2 cups flour", "350 ml flour"],
    ["mixed unicode fraction", "1½ cups flour", "350 ml flour"],
    ["spaced unicode fraction", "1 ½ cups flour", "350 ml flour"],
    ["decimal", "1.5 cups flour", "350 ml flour"],
    ["leading-dot decimal", ".5 cup sugar", "120 ml sugar"],
    ["thirds", "⅓ cup oil", "80 ml oil"],
    ["eighths", "⅞ cup oil", "210 ml oil"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });
});

describe("rewriteLine converts every US customary unit", () => {
  it.each([
    ["teaspoon abbreviation with dot", "1 tsp. salt", "5 ml salt"],
    ["capitalised tablespoon", "1 Tbsp butter", "15 ml butter"],
    ["tbs", "2 tbs oil", "30 ml oil"],
    ["fl oz", "8 fl oz cream", "240 ml cream"],
    ["fl. oz.", "4 fl. oz. cream", "120 ml cream"],
    ["fluid ounce", "1 fluid ounce rum", "30 ml rum"],
    ["pint", "1 pint cream", "470 ml cream"],
    ["pt", "2 pt cream", "950 ml cream"],
    ["quart", "1 quart stock", "950 ml stock"],
    ["qt", "½ qt stock", "470 ml stock"],
    ["gallon", "½ gallon water", "1.9 l water"],
    ["oz means weight", "8 oz cheddar", "230 g cheddar"],
    ["ounces", "16 ounces pasta", "450 g pasta"],
    ["ounce", "1 ounce chocolate", "30 g chocolate"],
    ["lb", "1 lb ground beef", "450 g ground beef"],
    ["lbs.", "2 lbs. potatoes", "910 g potatoes"],
    ["pounds", "3 pounds chicken thighs", "1.4 kg chicken thighs"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });
});

describe("rewriteLine rounds to amounts a cook would measure", () => {
  it.each([
    ["under 2.5 ml: one decimal", "⅛ tsp cayenne", "0.6 ml cayenne"],
    ["under 2.5 ml: never zero", "¼ tsp salt", "1.2 ml salt"],
    ["spoon step 5 ml", "1 tsp salt", "5 ml salt"],
    ["spoon step 7.5 ml", "1½ tsp salt", "7.5 ml salt"],
    ["spoon step 12.5 ml", "2½ tsp salt", "12.5 ml salt"],
    ["spoon step 15 ml", "1 tbsp oil", "15 ml oil"],
    ["nearest 5 under 100 ml", "5 tbsp oil", "75 ml oil"],
    ["nearest 10 under 1000 ml", "3 cups stock", "710 ml stock"],
    ["rounding up into litres", "4¼ cups stock", "1 l stock"],
    ["litres with one decimal", "6 cups stock", "1.4 l stock"],
    ["under 1 g: one decimal", "1/32 oz saffron", "0.9 g saffron"],
    ["whole grams under 15 g", "½ oz yeast", "14 g yeast"],
    ["nearest 5 under 100 g", "3 oz pancetta", "85 g pancetta"],
    ["nearest 10 under 1000 g", "¼ lb bacon", "110 g bacon"],
    ["kilograms with one decimal", "2.5 lb pork shoulder", "1.1 kg pork shoulder"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });
});

describe("rewriteLine formats numbers for the locale", () => {
  it.each([
    ["fi-FI", "6 cups stock", "1,4 l stock"],
    ["de-DE", "1½ tsp salt", "7,5 ml salt"],
    ["en-GB", "1½ tsp salt", "7.5 ml salt"],
  ])("%s: %s → %s", (locale, line, expected) => {
    expect(rewriteLine(line, { ...metric, locale })).toBe(expected);
  });

  it("uses the browser's language when no locale is given", () => {
    expect(rewriteLine("1½ tsp salt", { scale: 1, metric: true })).toBe(
      `${(7.5).toLocaleString(navigator.language)} ml salt`,
    );
  });
});

describe("rewriteLine converts ranges at both ends", () => {
  it.each([
    ["hyphen", "2-3 cups stock", "470–710 ml stock"],
    ["spaced en dash", "2 – 3 cups stock", "470–710 ml stock"],
    ["worded", "2 to 3 cups stock", "470–710 ml stock"],
    ["worded with or", "1 or 2 tsp salt", "5–10 ml salt"],
    ["from a fraction", "½-1 cup stock", "120–240 ml stock"],
    ["mixed numbers", "1 to 1½ tbsp oil", "15–20 ml oil"],
    ["across into litres", "4-6 cups stock", "950 ml–1.4 l stock"],
    ["litres at both ends", "6-8 cups stock", "1.4–1.9 l stock"],
    ["weight", "2-3 lb potatoes", "910 g–1.4 kg potatoes"],
    ["ends rounding to the same amount", "1 to 1⅛ tsp salt", "5 ml salt"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });

  it("scales both ends", () => {
    expect(rewriteLine("2-3 cups stock", { ...metric, scale: 2 })).toBe("950 ml–1.4 l stock");
  });
});

describe("rewriteLine combines compound amounts", () => {
  it.each([
    ["plus", "1 cup plus 2 tbsp milk", "270 ml milk"],
    ["plus sign", "1 cup + 2 tbsp milk", "270 ml milk"],
    ["three parts", "1 cup plus 2 tbsp plus 1 tsp milk", "270 ml milk"],
    ["weight", "1 lb plus 4 oz beef", "570 g beef"],
    ["with a range", "1 cup plus 2-3 tbsp milk", "270–280 ml milk"],
    ["volume and weight stay apart", "1 cup plus 2 oz cheese", "240 ml plus 55 g cheese"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });

  it("scales the combined amount", () => {
    expect(rewriteLine("1 cup plus 2 tbsp milk", { ...metric, scale: 2 })).toBe("530 ml milk");
  });
});

describe("rewriteLine leaves lines unchanged", () => {
  it.each([
    ["no quantity", "salt and pepper, to taste"],
    ["pinch", "pinch of salt"],
    ["to taste", "to taste"],
    ["plain count", "3 large eggs"],
    ["already metric", "250 ml milk"],
    ["unit-like word", "12 cupcake liners"],
    ["decimal comma", "1,5 cups flour"],
    ["two decimal points", "1.5.2 cups flour"],
    ["descending range", "3-2 cups stock"],
    ["zero denominator", "1/0 cup sugar"],
    ["improper fraction in a mixed number", "1 3/2 cups flour"],
    ["unreadable amount after a readable one", "1 cup sugar and 1,5 cups flour"],
    ["unreadable amount before a readable one", "1/0 tsp salt, 1 cup milk"],
  ])("%s: %s", (_, line) => {
    expect(rewriteLine(line, metric)).toBeNull();
  });
});

describe("rewriteLine options", () => {
  it("scales the amount before converting", () => {
    expect(rewriteLine("1 cup milk", { ...metric, scale: 2 })).toBe("470 ml milk");
    expect(rewriteLine("3 tsp salt", { ...metric, scale: 0.5 })).toBe("7.5 ml salt");
  });

  it("leaves the line unchanged when metric is off", () => {
    expect(rewriteLine("1 cup milk", { ...metric, metric: false })).toBeNull();
  });
});
