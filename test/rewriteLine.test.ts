import { describe, expect, it } from "vitest";
import { rewriteLine } from "../src/core/rewriteLine";

const metric = { scale: 1, metric: true };

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

describe("rewriteLine leaves lines unchanged", () => {
  it.each([
    ["no quantity", "salt and pepper, to taste"],
    ["plain count", "3 large eggs"],
    ["already metric", "250 ml milk"],
    ["mixed number", "1 1/2 cups flour"],
    ["ascii fraction", "1/2 cup sugar"],
    ["unicode fraction", "1½ cups flour"],
    ["decimal", "1.5 cups flour"],
    ["hyphen range", "2-3 cups stock"],
    ["worded range", "2 to 3 cups stock"],
    ["range from a fraction", "½-1 cup stock"],
    ["decimal comma", "1,5 cups flour"],
    ["unit-like word", "12 cupcake liners"],
  ])("%s: %s", (_, line) => {
    expect(rewriteLine(line, metric)).toBeNull();
  });
});

describe("rewriteLine options", () => {
  it("scales the amount before converting", () => {
    expect(rewriteLine("1 cup milk", { scale: 2, metric: true })).toBe("470 ml milk");
    expect(rewriteLine("3 tsp salt", { scale: 0.5, metric: true })).toBe("7.5 ml salt");
  });

  it("leaves the line unchanged when metric is off", () => {
    expect(rewriteLine("1 cup milk", { scale: 1, metric: false })).toBeNull();
  });
});
