import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attach, attachToSelection, attachWhenReady } from "../src/core/attach";

const settings = { metric: true, siteDisabled: false };

function loadFixture(name: string): Document {
  const html = readFileSync(join(__dirname, "fixtures", name), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}

function textsOf(doc: Document, selector: string): string[] {
  return [...doc.querySelectorAll(selector)].map((el) => el.textContent ?? "");
}

describe("attach on loveandlemons.com (WP Recipe Maker)", () => {
  const fixture = "loveandlemons-banana-pancakes.html";
  const ingredients = ".wprm-recipe-ingredient";

  it("rewrites every amount in the ingredient list to rounded metric, weighing dry ingredients", () => {
    const doc = loadFixture(fixture);

    attach(doc, settings);

    expect(textsOf(doc, ingredients)).toEqual([
      "▢ 150 g bread flour",
      "▢ 35 g granulated sugar",
      "▢ 5 ml baking powder",
      "▢ 2.5 ml ground ginger",
      "▢ 2.5 ml nutmeg",
      "▢ Heaping 1.2 ml fine salt",
      "▢ 1 large egg",
      "▢ 210 ml oat milk",
      "▢ 80 ml mashed ripe banana",
      "▢ 30 ml sunflower oil or melted butter, plus more for the pan",
      "▢ 5 ml almond extract",
      "▢ 350 ml sliced strawberries, fresh or frozen*",
      "▢ Honey, for drizzling",
    ]);
  });

  it("leaves everything outside the ingredient list untouched", () => {
    const doc = loadFixture(fixture);
    const outside = () =>
      [...doc.body.children].map((el) => (el.contains(doc.querySelector(ingredients)) ? "" : el.outerHTML));
    const before = outside();
    const notes = doc.querySelector(".wprm-recipe-notes")!.outerHTML;

    attach(doc, settings);

    expect(outside()).toEqual(before);
    expect(doc.querySelector(".wprm-recipe-notes")!.outerHTML).toBe(notes);
  });

  it("marks each rewritten piece and shows the original text as its tooltip", () => {
    const doc = loadFixture(fixture);

    attach(doc, settings);

    const marked = [...doc.querySelectorAll(`${ingredients} .sous-chefox-converted[title]`)];
    expect(marked.map((el) => [el.textContent, el.getAttribute("title")])).toEqual([
      ["150 g", "1¼ cups"],
      ["35 g", "3 tablespoons"],
      ["5 ml", "1 teaspoon"],
      ["2.5 ml", "½ teaspoon"],
      ["2.5 ml", "½ teaspoon"],
      ["1.2 ml", "¼ teaspoon"],
      ["210 ml", "¾ cup plus 2 tablespoons"],
      ["80 ml", "⅓ cup"],
      ["30 ml", "2 tablespoons"],
      ["5 ml", "1 teaspoon"],
      ["350 ml", "1½ cups"],
    ]);
  });

  it("restores the original markup exactly on revert", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;

    attach(doc, settings)!.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("does nothing on a second revert", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;
    const controller = attach(doc, settings)!;

    controller.revert();
    controller.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe("attach on loveandlemons.com blondies (WP Recipe Maker)", () => {
  const fixture = "loveandlemons-blondies.html";
  const ingredients = ".wprm-recipe-ingredient";

  it("weighs the dry ingredients and leaves liquids in ml", () => {
    const doc = loadFixture(fixture);

    attach(doc, settings);

    expect(textsOf(doc, ingredients)).toEqual([
      "▢ 180 g light brown sugar*",
      "▢ 120 g all-purpose flour",
      "▢ 30 g cornstarch, sifted",
      "▢ 40 g powdered sugar, sifted",
      "▢ 110 g white chocolate chips",
      "▢ 2.5 ml flaky salt",
      "▢ 2 large eggs",
      "▢ 120 ml melted butter or coconut oil**",
      "▢ 45 ml milk",
      "▢ 5 ml vanilla",
    ]);
  });

  it("converts the oven temperature and pan sizes in the instructions", () => {
    const doc = loadFixture(fixture);

    attach(doc, settings);

    const steps = textsOf(doc, ".wprm-recipe-instruction");
    expect(steps[0]).toBe(
      "Preheat the oven to 175 °C. Butter an 20×20 cm baking tin (a 23×23 cm tin gives thinner bars) and line it with parchment.",
    );
    expect(steps.slice(1)).toEqual(textsOf(loadFixture(fixture), ".wprm-recipe-instruction").slice(1));
    const marked = [...doc.querySelectorAll(".wprm-recipe-instruction .sous-chefox-converted[title]")];
    expect(marked.map((el) => [el.textContent, el.getAttribute("title")])).toEqual([
      ["175 °C", "350°F"],
      ["20×20 cm", "8x8"],
      ["23×23 cm", "9x9"],
    ]);
  });

  it("leaves temperatures and sizes outside the recipe's instructions untouched", () => {
    const doc = loadFixture(fixture);
    const instructions = ".wprm-recipe-instructions";
    const outside = () => [...doc.querySelectorAll("p, li")].filter((el) => !el.closest(instructions)).map((el) => el.outerHTML);
    const before = outside().filter((html) => !html.includes("wprm-recipe-ingredient"));

    attach(doc, settings);

    expect(outside().filter((html) => !html.includes("wprm-recipe-ingredient"))).toEqual(before);
    expect(before.some((html) => html.includes("8×8 inch baking pan"))).toBe(true);
  });

  it("restores the original markup exactly on revert", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;

    attach(doc, settings)!.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

function page(html: string): Document {
  return new DOMParser().parseFromString(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`, "text/html");
}

function recipePage(ingredients: string[], steps: string[] = [], recipeYield?: unknown): Document {
  const recipe = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    recipeYield,
    recipeIngredient: ingredients,
    recipeInstructions: steps.map((text) => ({ "@type": "HowToStep", text })),
  };
  return page(`
    <script type="application/ld+json">${JSON.stringify(recipe)}</script>
    <ul>${ingredients.map((line) => `<li>${line}</li>`).join("")}</ul>
    <ol class="steps">${steps.map((step) => `<li>${step}</li>`).join("")}</ol>
    <p>Preheat the oven to 350°F and grab a 9x13-inch pan.</p>`);
}

describe("attach on lines that already show metric", () => {
  it("shows only the site's metric amount, with the whole original line as the tooltip", () => {
    const doc = recipePage(["1 cup (120 g) flour", "200 g (7 oz) dark chocolate", "250 ml milk", "2 tbsp sugar"]);

    attach(doc, settings);

    expect(textsOf(doc, "li")).toEqual(["120 g flour", "200 g dark chocolate", "250 ml milk", "25 g sugar"]);
    const marked = [...doc.querySelectorAll(".sous-chefox-converted[title]")];
    expect(marked.map((el) => [el.textContent, el.getAttribute("title")])).toEqual([
      ["120 g", "1 cup (120 g) flour"],
      ["200 g", "200 g (7 oz) dark chocolate"],
      ["25 g", "2 tbsp"],
    ]);
  });

  it("moves a metric amount given after the name into place, with one tooltip", () => {
    const doc = recipePage(["1 cup granulated sugar (200 g)", "2 eggs"]);

    attach(doc, settings);

    expect(textsOf(doc, "li")).toEqual(["200 g granulated sugar", "2 eggs"]);
    const marked = [...doc.querySelectorAll(".sous-chefox-converted[title]")];
    expect(marked.map((el) => [el.textContent, el.getAttribute("title")])).toEqual([
      ["200 g", "1 cup granulated sugar (200 g)"],
    ]);
  });

  it("restores the original markup exactly on revert", () => {
    const doc = recipePage(["1 cup (120 g) flour", "200 g (7 oz) dark chocolate", "1 cup granulated sugar (200 g)"]);
    const before = doc.documentElement.outerHTML;

    attach(doc, settings)!.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe("attach on instruction temperatures and lengths", () => {
  const ingredients = ["2 cups rice", "1 cup lentils", "1 tsp salt"];

  it.each([
    ["°F", "Preheat the oven to 350°F.", "Preheat the oven to 175 °C."],
    ["spaced °F", "Bake at 425 °F for 20 minutes.", "Bake at 220 °C for 20 minutes."],
    ["degrees F", "Bake at 400 degrees F until golden.", "Bake at 205 °C until golden."],
    ["degrees Fahrenheit", "Heat the oil to 325 degrees Fahrenheit.", "Heat the oil to 165 °C."],
    ["bare F", "Bake at 375F.", "Bake at 190 °C."],
    ["range", "Bake at 400-425°F.", "Bake at 205–220 °C."],
    ["°C given after °F", "Preheat the oven to 350°F (180°C).", "Preheat the oven to 180°C."],
    ["°C given before °F", "Preheat the oven to 180°C/350°F.", "Preheat the oven to 180°C."],
    ["°C alone", "Preheat the oven to 180°C.", "Preheat the oven to 180°C."],
    ["°C with the degree sign after", "Heat the oven to 200C°/390°F (180°C fan).", "Heat the oven to 200C° (180°C fan)."],
    ["pan size", "Grease a 9×13-inch pan.", "Grease a 23×33 cm pan."],
    ["pan size with x and spaces", "Use a 9 x 5 inch loaf pan.", "Use a 23×13 cm loaf pan."],
    ["pan size with by", "Use a 9 by 13 inch dish.", "Use a 23×33 cm dish."],
    ["pan size without a unit", "Line an 8x8 baking pan.", "Line an 20×20 cm baking pan."],
    ["round pan", "Grease two 9-inch round cake pans.", "Grease two 23 cm round cake pans."],
    ["thickness", "Roll the dough to ¼ inch thick.", "Roll the dough to 6 mm thick."],
    ["hyphenated fraction", "Cut into 1/2-inch cubes.", "Cut into 13 mm cubes."],
    ["inches", "Space them 2 inches apart.", "Space them 5 cm apart."],
    ["length range", "Cut into 1 to 2 inch pieces.", "Cut into 2.5–5 cm pieces."],
    ["thickness range", "Roll to ¼ to ½ inch.", "Roll to 6–13 mm."],
    ["number that isn't a size", "Bake for 25 to 30 minutes in 2 batches.", "Bake for 25 to 30 minutes in 2 batches."],
    ["cup measure", "Use a ⅓-cup scoop.", "Use a ⅓-cup scoop."],
    ["inch mark", 'Heat a 10" skillet.', "Heat a 25 cm skillet."],
    ["inch mark on a fraction", 'Cut into 1/2" cubes.', "Cut into 13 mm cubes."],
    ["curly inch mark", "Heat a 10” skillet.", "Heat a 25 cm skillet."],
    ["cm given after inches", "Space them 4 inches (10 cm) apart.", "Space them 10 cm apart."],
    ["cm given before inches", 'Butter 2 x 18cm/7" sandwich tins.', "Butter 2 x 18cm sandwich tins."],
    ["cm in a bracket that isn't closed", "Space them 4 inches (10 cm apart.", "Space them 4 inches (10 cm apart."],
    ["baking sheet without a unit", "Line a 13x18 baking sheet.", "Line a 33×46 cm baking sheet."],
    ["count of sheets", "Layer 3 x 2 sheets of lasagna.", "Layer 3 x 2 sheets of lasagna."],
    ["F that isn't a temperature", "Fold in 2 F of the batter.", "Fold in 2 F of the batter."],
  ])("%s: %s → %s", (_, step, expected) => {
    const doc = recipePage(ingredients, [step, "Stir everything together and serve warm."]);

    attach(doc, settings);

    expect(textsOf(doc, ".steps li")[0]).toBe(expected);
  });

  it("formats numbers for the locale", () => {
    const doc = recipePage(ingredients, ["Roll to ½ inch, then cut into 1-inch squares.", "Stir everything together and serve warm."]);
    const language = navigator.language;

    attach(doc, settings);

    expect(textsOf(doc, ".steps li")[0]).toBe(
      `Roll to 13 mm, then cut into ${(2.5).toLocaleString(language)} cm squares.`,
    );
  });

  it("marks each converted piece with its original text as the tooltip", () => {
    const doc = recipePage(ingredients, ["Preheat the oven to 350°F (180°C) and grease a 9×13-inch pan.", "Stir everything together and serve warm."]);

    attach(doc, settings);

    const marked = [...doc.querySelectorAll(".steps .sous-chefox-converted[title]")];
    expect(marked.map((el) => [el.textContent, el.getAttribute("title")])).toEqual([
      ["180°C", "350°F (180°C)"],
      ["23×33 cm", "9×13-inch"],
    ]);
  });

  it("touches only the recipe's instructions", () => {
    const doc = recipePage(ingredients, ["Preheat the oven to 350°F.", "Stir everything together and serve warm."]);

    attach(doc, settings);

    expect(doc.querySelector("p")!.textContent).toBe("Preheat the oven to 350°F and grab a 9x13-inch pan.");
  });

  it("restores the original instructions exactly on revert", () => {
    const doc = recipePage(ingredients, ["Preheat the oven to 350°F (180°C) and grease a 9×13-inch pan.", "Stir everything together and serve warm."]);
    const before = doc.documentElement.outerHTML;

    attach(doc, settings)!.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("leaves the instructions alone with metric off", () => {
    const doc = recipePage(ingredients, ["Preheat the oven to 350°F.", "Stir everything together and serve warm."]);

    attach(doc, { metric: false, siteDisabled: false });

    expect(textsOf(doc, ".steps li")[0]).toBe("Preheat the oven to 350°F.");
  });
});

describe("attach on bbcgoodfood.com, a recipe that is already metric", () => {
  it("leaves the page as it is, spoons included, apart from adding the scaling control", () => {
    const doc = loadFixture("bbcgoodfood-yorkshire-puddings.html");
    const before = doc.documentElement.outerHTML;

    expect(attach(doc, settings)).not.toBeNull();

    expect(doc.querySelector("sous-chefox-scale")?.nextElementSibling).toBe(doc.querySelector("ul.ingredients-list"));
    doc.querySelector("sous-chefox-scale")!.remove();
    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe("attach on jamieoliver.com, a list of paragraphs that is already metric", () => {
  const fixture = "jamieoliver-parsley-carbonara.html";

  it("finds the ingredient paragraphs and puts the scaling control above them", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;

    expect(attach(doc, settings)).not.toBeNull();

    expect(doc.querySelector("sous-chefox-scale")?.nextElementSibling).toBe(doc.querySelector(".ingredients-rich-text"));
    doc.querySelector("sous-chefox-scale")!.remove();
    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe("attach on pages it doesn't handle", () => {
  it("returns null and changes nothing on a page without recipe data", () => {
    const doc = page("<h1>Shopping list</h1><ul><li>2 cups rice</li><li>1 cup lentils</li></ul>");
    const before = doc.documentElement.outerHTML;

    expect(attach(doc, settings)).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("returns null and changes nothing when the ingredient list can't be found confidently", () => {
    const doc = page(`
      <script type="application/ld+json">
        {"@context": "https://schema.org", "@type": "Recipe",
         "recipeIngredient": ["2 cups rice", "1 cup lentils", "4 cups water", "1 tsp salt"]}
      </script>
      <p>Cook 2 cups rice and 1 cup lentils in water.</p>
      <ul><li>2 cups rice</li><li>Some unrelated note about the weather</li></ul>`);
    const before = doc.documentElement.outerHTML;

    expect(attach(doc, settings)).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("returns null and changes nothing when the site is disabled", () => {
    const doc = loadFixture("loveandlemons-banana-pancakes.html");
    const before = doc.documentElement.outerHTML;

    expect(attach(doc, { metric: true, siteDisabled: true })).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("finds recipes published as microdata", () => {
    const doc = page(`
      <div itemscope itemtype="https://schema.org/Recipe">
        <h2 itemprop="name">Rice and lentils</h2>
        <ul>
          <li itemprop="recipeIngredient">2 cups rice</li>
          <li itemprop="recipeIngredient">1 cup lentils</li>
          <li itemprop="recipeIngredient">1 tsp salt</li>
        </ul>
      </div>`);

    expect(attach(doc, settings)).not.toBeNull();
    expect(textsOf(doc, "li")).toEqual(["400 g rice", "240 ml lentils", "5 ml salt"]);
  });
});

describe("scaling control", () => {
  const fixture = "loveandlemons-banana-pancakes.html";
  const ingredients = ".wprm-recipe-ingredient";
  const doubled = [
    "▢ 300 g bread flour",
    "▢ 75 g granulated sugar",
    "▢ 10 ml baking powder",
    "▢ 5 ml ground ginger",
    "▢ 5 ml nutmeg",
    "▢ Heaping 2.5 ml fine salt",
    "▢ 2 large egg",
    "▢ 410 ml oat milk",
    "▢ 160 ml mashed ripe banana",
    "▢ 60 ml sunflower oil or melted butter, plus more for the pan",
    "▢ 10 ml almond extract",
    "▢ 710 ml sliced strawberries, fresh or frozen*",
    "▢ Honey, for drizzling",
  ];

  function control(doc: Document) {
    const host = doc.querySelector("sous-chefox-scale")!;
    const root = host.shadowRoot!;
    const input = root.querySelector("input")!;
    return {
      host,
      input,
      reset: root.querySelector<HTMLButtonElement>("button.reset")!,
      servings: () => root.querySelector(".servings output")?.textContent ?? null,
      fewer: root.querySelector<HTMLButtonElement>("button.fewer"),
      more: root.querySelector<HTMLButtonElement>("button.more"),
      type(value: string) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
    };
  }

  it("is rendered in a shadow root directly above the ingredient list, at 1×", () => {
    const doc = loadFixture(fixture);

    attach(doc, settings);

    const { host, input } = control(doc);
    expect(host.nextElementSibling).toBe(doc.querySelector(".wprm-recipe-ingredients"));
    expect(input.value).toBe("1");
    expect(input.getAttribute("aria-invalid")).not.toBe("true");
  });

  it("scales every ingredient amount when a multiplier is typed", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);

    control(doc).type("2");

    expect(textsOf(doc, ingredients)).toEqual(doubled);
  });

  it("accepts a decimal", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);

    control(doc).type("1.5");

    expect(textsOf(doc, ingredients).slice(0, 2)).toEqual(["▢ 230 g bread flour", "▢ 55 g granulated sugar"]);
    expect(textsOf(doc, ingredients)[6]).toBe("▢ 1½ large egg");
  });

  // jsdom doesn't localise number inputs; Firefox reads and shows "1,5" for a Finnish one.
  it("is a number input in the browser's language, stepping by quarters", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);

    const { input } = control(doc);

    expect(input.type).toBe("number");
    expect(input.lang).toBe(navigator.language);
    expect([input.step, input.min, input.max]).toEqual(["0.25", "0.25", "20"]);
  });

  // A number input keeps text it can't read on screen but reads it as "", which is what
  // jsdom gives for "abc", "1/2" and "1.5.2".
  it.each([
    ["not a number", "abc"],
    ["a fraction", "1/2"],
    ["two separators", "1.5.2"],
    ["above 20", "25"],
    ["below 0.1", "0.05"],
    ["empty", ""],
  ])("highlights %s and keeps the last valid scale", (_, typed) => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);
    scale.type("2");

    scale.type(typed);

    expect(scale.input.getAttribute("aria-invalid")).toBe("true");
    expect(textsOf(doc, ingredients)).toEqual(doubled);
  });

  it("clears the highlight once the input is valid again", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    scale.type("abc");
    scale.type("2");

    expect(scale.input.getAttribute("aria-invalid")).not.toBe("true");
    expect(textsOf(doc, ingredients)).toEqual(doubled);
  });

  it("accepts the ends of the range", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    scale.type("20");
    expect(scale.input.getAttribute("aria-invalid")).not.toBe("true");
    expect(textsOf(doc, ingredients)[6]).toBe("▢ 20 large egg");

    scale.type("0.1");
    expect(scale.input.getAttribute("aria-invalid")).not.toBe("true");
    expect(textsOf(doc, ingredients)[6]).toBe("▢ ⅛ large egg");
  });

  it("resets to 1× with the reset button", () => {
    const doc = loadFixture(fixture);
    const atOne = loadFixture(fixture);
    attach(atOne, settings);
    attach(doc, settings);
    const scale = control(doc);
    scale.type("abc");
    scale.type("2");
    scale.type("abc");

    scale.reset.click();

    expect(scale.input.value).toBe("1");
    expect(scale.input.getAttribute("aria-invalid")).not.toBe("true");
    expect(doc.documentElement.outerHTML).toBe(atOne.documentElement.outerHTML);
  });

  it("setScale has the same effect as the control", () => {
    const doc = loadFixture(fixture);
    const controller = attach(doc, settings)!;

    controller.setScale(2);

    expect(control(doc).input.value).toBe("2");
    expect(textsOf(doc, ingredients)).toEqual(doubled);
  });

  it("re-renders from the original text, not from the rewritten text", () => {
    const doc = loadFixture(fixture);
    const atOne = loadFixture(fixture);
    attach(atOne, settings);
    const controller = attach(doc, settings)!;

    controller.setScale(3);
    controller.setScale(0.5);
    controller.setScale(1);

    expect(doc.documentElement.outerHTML).toBe(atOne.documentElement.outerHTML);
  });

  it("keeps the original text as the tooltip when scaled", () => {
    const doc = loadFixture(fixture);
    const controller = attach(doc, settings)!;

    controller.setScale(2);

    const marked = [...doc.querySelectorAll(`${ingredients} .sous-chefox-converted[title]`)];
    expect(marked.slice(0, 2).map((el) => [el.textContent, el.getAttribute("title")])).toEqual([
      ["300 g", "1¼ cups"],
      ["75 g", "3 tablespoons"],
    ]);
    expect(marked.find((el) => el.textContent === "2")?.getAttribute("title")).toBe("1");
  });

  it("restores the original markup exactly on revert, removing the control", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;
    const controller = attach(doc, settings)!;
    controller.setScale(2);

    controller.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
    expect(doc.querySelector("sous-chefox-scale")).toBeNull();
  });

  it("starts at 1× on every page load", () => {
    attach(loadFixture(fixture), settings)!.setScale(2);
    const doc = loadFixture(fixture);
    const atOne = loadFixture(fixture);
    attach(atOne, settings);

    attach(doc, settings);

    expect(control(doc).input.value).toBe("1");
    expect(textsOf(doc, ingredients)).toEqual(textsOf(atOne, ingredients));
  });

  it("never scales the instructions", () => {
    const doc = loadFixture("loveandlemons-blondies.html");
    const atOne = loadFixture("loveandlemons-blondies.html");
    attach(atOne, settings);
    const controller = attach(doc, settings)!;

    controller.setScale(2);

    expect(textsOf(doc, ".wprm-recipe-instruction")).toEqual(textsOf(atOne, ".wprm-recipe-instruction"));
    expect(textsOf(doc, ".wprm-recipe-ingredient")[0]).toBe("▢ 360 g light brown sugar*");
  });

  it("shows a servings stepper at the recipe's yield", () => {
    const doc = loadFixture(fixture);

    attach(doc, settings);

    expect(control(doc).servings()).toBe("4");
  });

  it("steps the servings and shows the matching multiplier", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    scale.more!.click();
    scale.more!.click();

    expect(scale.servings()).toBe("6");
    expect(scale.input.value).toBe("1.5");
    expect(textsOf(doc, ingredients)[6]).toBe("▢ 1½ large egg");
  });

  it("steps down to fewer servings", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    scale.fewer!.click();
    scale.fewer!.click();

    expect(scale.servings()).toBe("2");
    expect(scale.input.value).toBe("0.5");
    expect(textsOf(doc, ingredients)[0]).toBe("▢ 75 g bread flour");
  });

  it("shows the servings a typed multiplier gives", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    scale.type("2");
    expect(scale.servings()).toBe("8");

    scale.type("abc");
    expect(scale.servings()).toBe("8");
  });

  it("steps from a fractional number of servings to the next whole one", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);
    scale.type("1.1");
    expect(scale.servings()).toBe("4.4");

    scale.more!.click();
    expect(scale.servings()).toBe("5");
    expect(scale.input.value).toBe("1.25");

    scale.type("1.1");
    scale.fewer!.click();
    expect(scale.servings()).toBe("4");
    expect(scale.input.value).toBe("1");
  });

  it("goes no lower than one serving", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    for (let i = 0; i < 5; i++) scale.fewer!.click();

    expect(scale.servings()).toBe("1");
    expect(scale.input.value).toBe("0.25");
    expect(scale.fewer!.disabled).toBe(true);
  });

  it("goes no higher than the largest multiplier", () => {
    const doc = recipePage(["2 cups rice"], [], "Serves 2");
    attach(doc, settings);
    const scale = control(doc);
    scale.type("19.5");

    scale.more!.click();
    expect(scale.servings()).toBe("40");
    expect(scale.input.value).toBe("20");
    expect(scale.more!.disabled).toBe(true);
  });

  it("setScale updates the stepper too", () => {
    const doc = loadFixture(fixture);
    const controller = attach(doc, settings)!;

    controller.setScale(0.75);

    expect(control(doc).servings()).toBe("3");
  });

  it("resets the servings and the multiplier together", () => {
    const doc = loadFixture(fixture);
    const atOne = loadFixture(fixture);
    attach(atOne, settings);
    attach(doc, settings);
    const scale = control(doc);
    scale.more!.click();

    scale.reset.click();

    expect(scale.servings()).toBe("4");
    expect(scale.input.value).toBe("1");
    expect(doc.documentElement.outerHTML).toBe(atOne.documentElement.outerHTML);
  });

  it.each([
    ["a number", 4, "4"],
    ["a number as text", "6", "6"],
    ["servings", "4 servings", "4"],
    ["a serving", "1 serving", "1"],
    ["portions", "8 portions", "8"],
    ["people", "6 people", "6"],
    ["Serves", "Serves 4", "4"],
    ["Servings:", "Servings: 10", "10"],
    ["Serves people", "Serves 4 people", "4"],
    ["Yield:", "Yield: 4 servings", "4"],
    ["Makes servings", "Makes 4 servings", "4"],
    ["an array", ["16", "16 brownies"], "16"],
    ["an array with the servings second", ["1 loaf", "8 servings"], "8"],
  ])("reads the servings from %s", (_, recipeYield, expected) => {
    const doc = recipePage(["2 cups rice", "1 cup lentils"], [], recipeYield);

    attach(doc, settings);

    expect(control(doc).servings()).toBe(expected);
  });

  it.each([
    ["no yield", undefined],
    ["a loaf", "1 loaf"],
    ["a number of things", "Makes 12"],
    ["things after a number", ["16 brownies"]],
    ["a range", "Serves 4-6"],
    ["a range of servings", "4 to 6 servings"],
    ["zero", "0"],
  ])("shows only the multiplier for %s", (_, recipeYield) => {
    const doc = recipePage(["2 cups rice", "1 cup lentils"], [], recipeYield);

    attach(doc, settings);

    const scale = control(doc);
    expect(scale.servings()).toBeNull();
    expect(scale.more).toBeNull();
    scale.type("2");
    expect(textsOf(doc, "ul li")).toEqual(["790 g rice", "470 ml lentils"]);
  });

  it("scales a recipe that is already metric", () => {
    const doc = loadFixture("bbcgoodfood-yorkshire-puddings.html");
    const controller = attach(doc, settings)!;

    controller.setScale(2);

    expect(textsOf(doc, ".ingredients-list__item")).toEqual([
      "280 g plain flour",
      "8 medium eggs",
      "400 ml semi-skimmed milk",
      "4 tbsp sunflower oil plus extra for the tin",
      "gravy to serve (optional)",
      "a pinch of salt",
    ]);
  });
});

describe("live settings", () => {
  const fixture = "loveandlemons-blondies.html";
  const pancakes = "loveandlemons-banana-pancakes.html";
  const ingredients = ".wprm-recipe-ingredient";
  const metricOff = { metric: false, siteDisabled: false };
  const disabled = { metric: true, siteDisabled: true };

  function withoutControl(doc: Document): string {
    const clone = doc.documentElement.cloneNode(true) as Element;
    clone.querySelector("sous-chefox-scale")?.remove();
    return clone.outerHTML;
  }

  it("turning metric off restores the original text exactly, keeping the control", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;
    const controller = attach(doc, settings)!;

    controller.setSettings(metricOff);

    expect(doc.querySelector("sous-chefox-scale")).not.toBeNull();
    expect(withoutControl(doc)).toBe(before);
  });

  it("turning metric back on rewrites the page again", () => {
    const doc = loadFixture(fixture);
    const fresh = loadFixture(fixture);
    attach(fresh, settings);
    const controller = attach(doc, settings)!;

    controller.setSettings(metricOff);
    controller.setSettings(settings);

    expect(doc.documentElement.outerHTML).toBe(fresh.documentElement.outerHTML);
  });

  it("starting with metric off leaves the page as it is, apart from the control", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;

    expect(attach(doc, metricOff)).not.toBeNull();

    expect(withoutControl(doc)).toBe(before);
  });

  it("disabling the site restores the original markup exactly and removes the control", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;
    const controller = attach(doc, settings)!;
    controller.setScale(2);

    controller.setSettings(disabled);

    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("enabling the site again rewrites the page at 1×", () => {
    const doc = loadFixture(fixture);
    const fresh = loadFixture(fixture);
    attach(fresh, settings);
    const controller = attach(doc, settings)!;
    controller.setScale(2);

    controller.setSettings(disabled);
    controller.setSettings(settings);

    expect(doc.documentElement.outerHTML).toBe(fresh.documentElement.outerHTML);
  });

  it("keeps the scale when metric is turned off, showing the original units as fractions", () => {
    const doc = loadFixture(pancakes);
    const controller = attach(doc, settings)!;
    controller.setScale(1.5);

    controller.setSettings(metricOff);

    expect(doc.querySelector("sous-chefox-scale")!.shadowRoot!.querySelector("input")!.value).toBe("1.5");
    expect(textsOf(doc, ingredients)).toEqual([
      "▢ 1¾ cups bread flour",
      "▢ 4½ tablespoons granulated sugar",
      "▢ 1½ teaspoons baking powder",
      "▢ ¾ teaspoon ground ginger",
      "▢ ¾ teaspoon nutmeg",
      "▢ Heaping ⅓ teaspoon fine salt",
      "▢ 1½ large egg",
      "▢ 1⅛ cups plus 3 tablespoons oat milk",
      "▢ ½ cup mashed ripe banana",
      "▢ 3 tablespoons sunflower oil or melted butter, plus more for the pan",
      "▢ 1½ teaspoons almond extract",
      "▢ 2¼ cups sliced strawberries, fresh or frozen*",
      "▢ Honey, for drizzling",
    ]);
  });

  it("scales with metric off and shows the original text as the tooltip", () => {
    const doc = loadFixture(pancakes);
    const controller = attach(doc, metricOff)!;

    controller.setScale(0.5);

    const marked = [...doc.querySelectorAll(`${ingredients} .sous-chefox-converted[title]`)];
    expect(marked.slice(0, 2).map((el) => [el.textContent, el.getAttribute("title")])).toEqual([
      ["⅔ cup", "1¼ cups"],
      ["1½ tablespoons", "3 tablespoons"],
    ]);
  });

  it("leaves instructions alone with metric off and converts them once it's on", () => {
    const doc = loadFixture(fixture);
    const original = textsOf(doc, ".wprm-recipe-instruction")[0];
    const controller = attach(doc, metricOff)!;
    expect(textsOf(doc, ".wprm-recipe-instruction")[0]).toBe(original);

    controller.setSettings(settings);

    expect(textsOf(doc, ".wprm-recipe-instruction")[0]).toContain("175 °C");
  });

  it("revert after disabling the site leaves the original markup", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;
    const controller = attach(doc, settings)!;

    controller.setSettings(disabled);
    controller.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("ignores settings after revert", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;
    const controller = attach(doc, settings)!;

    controller.revert();
    controller.setSettings(metricOff);
    controller.setSettings(settings);
    controller.setScale(2);

    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe("attachToSelection on a page without structured data", () => {
  const ingredients = ".wprm-recipe-ingredient";

  function withoutRecipeData(): Document {
    const doc = loadFixture("loveandlemons-banana-pancakes.html");
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) script.remove();
    return doc;
  }

  /** A range from the start of `first` to the end of `last`. */
  function selection(first: Node, last: Node = first): Range {
    const range = first.ownerDocument!.createRange();
    range.setStartBefore(first);
    range.setEndAfter(last);
    return range;
  }

  function selectIngredients(doc: Document, from = 0, to?: number): Range {
    const lines = [...doc.querySelectorAll(ingredients)];
    return selection(lines[from]!, lines[to ?? lines.length - 1]!);
  }

  it("isn't attached automatically", () => {
    const doc = withoutRecipeData();

    expect(attach(doc, settings)).toBeNull();
  });

  it("rewrites the selected lines exactly like automatic conversion", () => {
    const doc = withoutRecipeData();
    const automatic = loadFixture("loveandlemons-banana-pancakes.html");
    attach(automatic, settings);

    expect(attachToSelection(doc, selectIngredients(doc), settings)).not.toBeNull();

    expect(textsOf(doc, ingredients)).toEqual(textsOf(automatic, ingredients));
    const tooltips = (d: Document) =>
      [...d.querySelectorAll(`${ingredients} .sous-chefox-converted`)].map((el) => el.outerHTML);
    expect(tooltips(doc)).toEqual(tooltips(automatic));
  });

  it("rewrites only the lines the selection touches", () => {
    const doc = withoutRecipeData();
    const original = textsOf(doc, ingredients);
    const range = doc.createRange();
    const lines = [...doc.querySelectorAll(ingredients)];
    // From the middle of the second line to the middle of the third.
    range.setStart(lines[1]!.querySelector(".wprm-recipe-ingredient-unit")!.firstChild!, 2);
    range.setEnd(lines[2]!.querySelector(".wprm-recipe-ingredient-amount")!.firstChild!, 1);

    attachToSelection(doc, range, settings);

    expect(textsOf(doc, ingredients)).toEqual([
      original[0],
      "▢ 35 g granulated sugar",
      "▢ 5 ml baking powder",
      ...original.slice(3),
    ]);
  });

  it("puts a multiplier-only scaling control directly above the selection", () => {
    const doc = withoutRecipeData();

    attachToSelection(doc, selectIngredients(doc), settings);

    const host = doc.querySelector("sous-chefox-scale")!;
    expect(host.nextElementSibling).toBe(doc.querySelector(".wprm-recipe-ingredients"));
    expect(host.shadowRoot!.querySelector(".servings")).toBeNull();
    expect(host.shadowRoot!.querySelector("input")!.value).toBe("1");
  });

  it("puts the control directly above a selection that starts partway down a list", () => {
    const doc = withoutRecipeData();
    const lines = [...doc.querySelectorAll(ingredients)];

    attachToSelection(doc, selectIngredients(doc, 1, 2), settings);

    expect(doc.querySelector("sous-chefox-scale")!.nextElementSibling).toBe(lines[1]);
  });

  it("scales the selected lines with the control", () => {
    const doc = withoutRecipeData();
    attachToSelection(doc, selectIngredients(doc, 0, 1), settings);
    const input = doc.querySelector("sous-chefox-scale")!.shadowRoot!.querySelector("input")!;

    input.value = "2";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(textsOf(doc, ingredients).slice(0, 3)).toEqual([
      "▢ 300 g bread flour",
      "▢ 75 g granulated sugar",
      "▢ 1 teaspoon baking powder",
    ]);
  });

  it("follows the settings", () => {
    const doc = withoutRecipeData();
    const before = doc.documentElement.outerHTML;
    const controller = attachToSelection(doc, selectIngredients(doc), { metric: false, siteDisabled: false })!;
    controller.setScale(2);
    expect(textsOf(doc, ingredients)[0]).toBe("▢ 2½ cups bread flour");

    controller.setSettings({ metric: true, siteDisabled: true });

    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("restores the original markup exactly on revert", () => {
    const doc = withoutRecipeData();
    const before = doc.documentElement.outerHTML;
    const controller = attachToSelection(doc, selectIngredients(doc), settings)!;
    controller.setScale(3);

    controller.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("converts paragraphs and lines split by line breaks, leaving lines it can't read as written", () => {
    const doc = page(`
      <article>
        <p>You'll need:</p>
        <p>1 cup flour<br>2 tbsp <b>sugar</b><br>\n1 cup sugar and 1,250 cups flour</p>
        <p>1 cup milk</p>
        <p>Mix it all.</p>
      </article>`);
    const paragraphs = [...doc.querySelectorAll("p")];

    attachToSelection(doc, selection(paragraphs[1]!, paragraphs[2]!), settings);

    expect(paragraphs[1]!.innerHTML).toBe(
      '<span class="sous-chefox-converted" title="1 cup">120 g</span> flour<br>' +
        '<span class="sous-chefox-converted" title="2 tbsp">25 g</span> <b>sugar</b><br>\n1 cup sugar and 1,250 cups flour',
    );
    expect(paragraphs[2]!.textContent).toBe("240 ml milk");
    expect(paragraphs[0]!.textContent).toBe("You'll need:");
    expect(doc.querySelector("sous-chefox-scale")!.nextElementSibling).toBe(paragraphs[1]);
  });

  it("converts a selection inside a single line", () => {
    const doc = page("<div><p>Stir in 2 cups milk and serve.</p></div>");
    const text = doc.querySelector("p")!.firstChild!;
    const range = doc.createRange();
    range.setStart(text, 8);
    range.setEnd(text, 20);

    attachToSelection(doc, range, settings);

    expect(doc.querySelector("p")!.textContent).toBe("Stir in 470 ml milk and serve.");
    expect(doc.querySelector("sous-chefox-scale")!.nextElementSibling).toBe(doc.querySelector("p"));
  });

  it("leaves lines that are already converted alone", () => {
    const doc = loadFixture("loveandlemons-banana-pancakes.html");
    attach(doc, settings);
    const converted = doc.documentElement.outerHTML;

    expect(attachToSelection(doc, selectIngredients(doc), settings)).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(converted);
  });

  it("leaves instruction steps that are already converted alone", () => {
    const doc = loadFixture("loveandlemons-blondies.html");
    attach(doc, settings);
    const converted = doc.documentElement.outerHTML;

    expect(attachToSelection(doc, selection(doc.querySelector(".wprm-recipe-instruction")!), settings)).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(converted);
  });

  it("keeps attach from converting lines converted by hand", () => {
    // A metric recipe reads the same once converted, so it would still be found.
    const doc = recipePage(["250 ml milk", "200 g flour", "2 eggs"]);
    attachToSelection(doc, selection(doc.querySelector("ul")!), settings);
    const converted = doc.documentElement.outerHTML;

    expect(attach(doc, settings)).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(converted);
  });

  it.each([
    ["nothing it can read", "<p>Salt and pepper, to taste</p>"],
    ["an empty selection", ""],
  ])("returns null and changes nothing for %s", (_, html) => {
    const doc = page(`<div>${html}</div><p>1 cup milk</p>`);
    const before = doc.documentElement.outerHTML;
    const range = doc.createRange();
    range.selectNodeContents(doc.querySelector("div")!);

    expect(attachToSelection(doc, range, settings)).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe("attach after a selection was converted", () => {
  it("leaves alone instruction steps a selection already converted", () => {
    const doc = recipePage(["2 cups rice", "1 cup lentils", "1 tsp salt"], ["Whisk in 1 cup milk, then bake at 350°F.", "Serve warm."]);
    const before = doc.documentElement.outerHTML;
    const step = doc.querySelector(".steps li")!;
    const range = doc.createRange();
    range.selectNodeContents(step);
    const selected = attachToSelection(doc, range, settings)!;
    const manual = step.innerHTML;

    const automatic = attach(doc, settings)!;

    expect(step.innerHTML).toBe(manual);
    expect(textsOf(doc, "ul li")).toEqual(["400 g rice", "240 ml lentils", "5 ml salt"]);
    automatic.revert();
    selected.revert();
    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe("attachWhenReady on an ingredient list that appears late", () => {
  const ingredients = ["2 cups rice", "1 cup lentils", "1 tsp salt"];
  const converted = ["400 g rice", "240 ml lentils", "5 ml salt"];

  /** The recipe page with its ingredient list taken out, to be put back later. */
  function withoutList(): { doc: Document; list: Element; putBack: () => void } {
    const doc = recipePage(ingredients);
    const list = doc.querySelector("ul")!;
    const after = list.nextSibling!;
    list.remove();
    return { doc, list, putBack: () => after.parentNode!.insertBefore(list, after) };
  }

  it("converts a list rendered after the page loads", async () => {
    const { doc, putBack } = withoutList();

    const attached = attachWhenReady(doc, settings);
    putBack();

    expect(await attached).not.toBeNull();
    expect(textsOf(doc, "ul li")).toEqual(converted);
  });

  describe("over time", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("still converts a list that appears two seconds after the page loads", async () => {
      vi.useFakeTimers();
      const { doc, putBack } = withoutList();

      const attached = attachWhenReady(doc, settings);
      await vi.advanceTimersByTimeAsync(2000);
      putBack();
      await vi.advanceTimersByTimeAsync(500);

      expect(await attached).not.toBeNull();
      expect(textsOf(doc, "ul li")).toEqual(converted);
    });

    it("stops watching for good after a few seconds", async () => {
      vi.useFakeTimers();
      const { doc, putBack } = withoutList();

      const attached = attachWhenReady(doc, settings);
      await vi.advanceTimersByTimeAsync(10_000);
      const before = doc.documentElement.outerHTML;
      putBack();
      const withList = doc.documentElement.outerHTML;
      await vi.advanceTimersByTimeAsync(10_000);

      expect(await attached).toBeNull();
      expect(withList).not.toBe(before);
      expect(doc.documentElement.outerHTML).toBe(withList);
    });

    it("doesn't watch a page without recipe data", async () => {
      vi.useFakeTimers();
      const doc = page("<h1>Shopping list</h1>");
      const list = doc.createElement("ul");
      list.innerHTML = "<li>2 cups rice</li><li>1 cup lentils</li>";

      const attached = attachWhenReady(doc, settings);

      expect(await attached).toBeNull();
      doc.body.append(list);
      const before = doc.documentElement.outerHTML;
      await vi.advanceTimersByTimeAsync(1000);
      expect(doc.documentElement.outerHTML).toBe(before);
    });

    it("doesn't watch when the site is disabled", async () => {
      vi.useFakeTimers();
      const { doc, putBack } = withoutList();

      const attached = attachWhenReady(doc, { metric: true, siteDisabled: true });

      expect(await attached).toBeNull();
      putBack();
      const before = doc.documentElement.outerHTML;
      await vi.advanceTimersByTimeAsync(1000);
      expect(doc.documentElement.outerHTML).toBe(before);
    });

    it("leaves the page unchanged when the list that appears can't be located confidently", async () => {
      vi.useFakeTimers();
      const { doc, list, putBack } = withoutList();
      list.innerHTML = "<li>2 cups rice</li><li>Some unrelated note about the weather</li>";

      const attached = attachWhenReady(doc, settings);
      putBack();
      const before = doc.documentElement.outerHTML;
      await vi.advanceTimersByTimeAsync(10_000);

      expect(await attached).toBeNull();
      expect(doc.documentElement.outerHTML).toBe(before);
    });
  });
});

/**
 * Pages shaped like real recipe sites (see each fixture's header): where the ingredient
 * list is, what every line becomes, the instruction steps that change (by index; the
 * rest stay as written) and the ingredients at 2×.
 */
const SITES: {
  site: string;
  fixture: string;
  list: string;
  items: string;
  steps: string;
  ingredients: string[];
  convertedSteps: Record<number, string>;
  doubled: string[];
}[] = [
  {
    site: "loveandlemons.com",
    fixture: "loveandlemons-banana-pancakes.html",
    list: "ul.wprm-recipe-ingredients",
    items: ".wprm-recipe-ingredient",
    steps: ".wprm-recipe-instruction",
    ingredients: [
      "▢ 150 g bread flour",
      "▢ 35 g granulated sugar",
      "▢ 5 ml baking powder",
      "▢ 2.5 ml ground ginger",
      "▢ 2.5 ml nutmeg",
      "▢ Heaping 1.2 ml fine salt",
      "▢ 1 large egg",
      "▢ 210 ml oat milk",
      "▢ 80 ml mashed ripe banana",
      "▢ 30 ml sunflower oil or melted butter, plus more for the pan",
      "▢ 5 ml almond extract",
      "▢ 350 ml sliced strawberries, fresh or frozen*",
      "▢ Honey, for drizzling",
    ],
    convertedSteps: {},
    doubled: [
      "▢ 300 g bread flour",
      "▢ 75 g granulated sugar",
      "▢ 10 ml baking powder",
      "▢ 5 ml ground ginger",
      "▢ 5 ml nutmeg",
      "▢ Heaping 2.5 ml fine salt",
      "▢ 2 large egg",
      "▢ 410 ml oat milk",
      "▢ 160 ml mashed ripe banana",
      "▢ 60 ml sunflower oil or melted butter, plus more for the pan",
      "▢ 10 ml almond extract",
      "▢ 710 ml sliced strawberries, fresh or frozen*",
      "▢ Honey, for drizzling",
    ],
  },
  {
    site: "loveandlemons.com",
    fixture: "loveandlemons-blondies.html",
    list: "ul.wprm-recipe-ingredients",
    items: ".wprm-recipe-ingredient",
    steps: ".wprm-recipe-instruction",
    ingredients: [
      "▢ 180 g light brown sugar*",
      "▢ 120 g all-purpose flour",
      "▢ 30 g cornstarch, sifted",
      "▢ 40 g powdered sugar, sifted",
      "▢ 110 g white chocolate chips",
      "▢ 2.5 ml flaky salt",
      "▢ 2 large eggs",
      "▢ 120 ml melted butter or coconut oil**",
      "▢ 45 ml milk",
      "▢ 5 ml vanilla",
    ],
    convertedSteps: {
      0: "Preheat the oven to 175 °C. Butter an 20×20 cm baking tin (a 23×23 cm tin gives thinner bars) and line it with parchment.",
    },
    doubled: [
      "▢ 360 g light brown sugar*",
      "▢ 240 g all-purpose flour",
      "▢ 55 g cornstarch, sifted",
      "▢ 75 g powdered sugar, sifted",
      "▢ 230 g white chocolate chips",
      "▢ 5 ml flaky salt",
      "▢ 4 large eggs",
      "▢ 240 ml melted butter or coconut oil**",
      "▢ 90 ml milk",
      "▢ 10 ml vanilla",
    ],
  },
  {
    site: "bbcgoodfood.com",
    fixture: "bbcgoodfood-yorkshire-puddings.html",
    list: "ul.ingredients-list",
    items: "ul.ingredients-list li",
    steps: "ul.method-steps__list li",
    ingredients: [
      "140g plain flour",
      "4 medium eggs",
      "200ml semi-skimmed milk",
      "2 tbsp sunflower oil plus extra for the tin",
      "gravy to serve (optional)",
      "a pinch of salt",
    ],
    convertedSteps: {},
    doubled: [
      "280 g plain flour",
      "8 medium eggs",
      "400 ml semi-skimmed milk",
      "4 tbsp sunflower oil plus extra for the tin",
      "gravy to serve (optional)",
      "a pinch of salt",
    ],
  },
  {
    site: "bbc.co.uk/food",
    fixture: "bbcfood-drop-scones.html",
    list: "div.ssrcss-1fh8kfn-Wrapper",
    items: "div.ssrcss-1fh8kfn-Wrapper li",
    steps: "ol.ssrcss-1o787j8-OrderedList li",
    ingredients: [
      "175g self-raising flour",
      "5 ml baking powder",
      "1.2 ml salt",
      "10 g golden caster sugar",
      "150ml milk",
      "1 medium egg",
      "15 g melted butter, plus extra for greasing",
      "jam, to serve",
      "clotted cream",
    ],
    convertedSteps: {},
    doubled: [
      "350 g self-raising flour",
      "10 ml baking powder",
      "2.5 ml salt",
      "25 g golden caster sugar",
      "300 ml milk",
      "2 medium egg",
      "30 g melted butter, plus extra for greasing",
      "jam, to serve",
      "clotted cream",
    ],
  },
  {
    site: "delish.com",
    fixture: "delish-lemon-dill-salmon.html",
    list: "ul.ingredient-lists",
    items: "ul.ingredient-lists li",
    steps: "ol.css-fhm74e li",
    ingredients: [
      "30 ml olive oil",
      "4 (140–200 g) salmon fillets",
      "Kosher salt",
      "Freshly ground black pepper",
      "5 ml dried dill",
      "30 g unsalted butter",
      "2 garlic cloves, thinly sliced",
      "240 ml green beans, trimmed",
      "470 ml baby kale",
      "80 ml heavy cream",
      "30 g Pecorino, finely grated (about 80 ml)",
      "Lemon wedges, for serving",
    ],
    convertedSteps: {},
    doubled: [
      "60 ml olive oil",
      "8 (140–200 g) salmon fillets",
      "Kosher salt",
      "Freshly ground black pepper",
      "10 ml dried dill",
      "55 g unsalted butter",
      "4 garlic cloves, thinly sliced",
      "470 ml green beans, trimmed",
      "950 ml baby kale",
      "160 ml heavy cream",
      "55 g Pecorino, finely grated (about 160 ml)",
      "Lemon wedges, for serving",
    ],
  },
  {
    site: "jamieoliver.com",
    fixture: "jamieoliver-parsley-carbonara.html",
    list: ".ingredients-rich-text",
    items: ".ingredients-rich-text p",
    steps: "ol li",
    ingredients: [
      "4 medium carrots",
      "400g spaghetti",
      "3 large free-range eggs",
      "150ml double cream",
      "1 small handful of pecorino cheese",
      "olive oil",
      "4 rashers of smoked streaky bacon",
      "½ a bunch of fresh flat-leaf parsley (15g)",
      "optional: a pinch of chilli flakes",
    ],
    convertedSteps: {},
    doubled: [
      "8 medium carrots",
      "800 g spaghetti",
      "6 large free-range eggs",
      "300 ml double cream",
      "2 small handful of pecorino cheese",
      "olive oil",
      "8 rashers of smoked streaky bacon",
      "1 a bunch of fresh flat-leaf parsley (30 g)",
      "optional: a pinch of chilli flakes",
    ],
  },
  {
    site: "kingarthurbaking.com",
    fixture: "kingarthur-lemon-layer-cake.html",
    list: ".ingredients-list",
    items: ".ingredients-list li",
    steps: "ol.list--numbers li",
    ingredients: [
      "300g Unbleached Cake Flour",
      "5 ml table salt",
      "12.5 ml baking powder",
      "3 large eggs, at room temperature",
      "347g granulated sugar",
      "9g Pure Vanilla Extract",
      "0.6 ml lemon oil, optional",
      "227g buttermilk, at room temperature",
      "113g butter, softened",
      "50g vegetable oil",
      "340g confectioners' sugar, sifted",
      "1.2 ml table salt",
      "43g lemon juice",
      "6g grated lemon zest",
      "227g butter, softened",
    ],
    convertedSteps: {
      0: "To make the cake: Preheat the oven to 175 °C with a rack in the center. Grease two 20 cm x 5 cm or 23 cm x 5 cm round pans and line the bottoms with parchment; if your 20 cm pans aren’t at least 5 cm deep, use 23 cm pans.",
      5: "Bake the cakes until golden and springy: 25 to 30 minutes for 23 cm pans, or 35 to 40 minutes for 20 cm pans; a thermometer in the center should read 95 °C. Cool in the pans for 10 minutes, then turn out onto a rack.",
      7: "To assemble the cake: Set one layer on a plate and spread it with a 6 mm to 13 mm-thick layer of frosting. Top with the second layer and frost the top and sides.",
    },
    doubled: [
      "600 g Unbleached Cake Flour",
      "10 ml table salt",
      "25 ml baking powder",
      "6 large eggs, at room temperature",
      "690 g granulated sugar",
      "20 g Pure Vanilla Extract",
      "1.2 ml lemon oil, optional",
      "450 g buttermilk, at room temperature",
      "230 g butter, softened",
      "100 g vegetable oil",
      "680 g confectioners' sugar, sifted",
      "2.5 ml table salt",
      "85 g lemon juice",
      "10 g grated lemon zest",
      "450 g butter, softened",
    ],
  },
  {
    site: "cooking.nytimes.com",
    fixture: "nytimes-oatmeal-raisin-cookies.html",
    list: ".ingredients_ingredients__FLjsC ul",
    items: ".ingredients_ingredients__FLjsC li",
    steps: "ol.preparation_stepList___jqWa li",
    ingredients: [
      "130 g rolled oats (140 g)",
      "120 g minus 15 g all-purpose flour (130 g)",
      "5 ml baking soda",
      "2.5 ml ground cinnamon",
      "5 ml flaky sea salt, plus more for sprinkling",
      "230 g unsalted butter (230 g)",
      "150 g light brown sugar (200 g)",
      "110 g granulated sugar (110 g)",
      "2 large eggs",
      "15 ml vanilla extract",
      "570 g raisins or chopped dates",
    ],
    convertedSteps: {},
    doubled: [
      "270 g rolled oats (280 g)",
      "240 g minus 30 g all-purpose flour (260 g)",
      "10 ml baking soda",
      "7.5 ml ground cinnamon",
      "10 ml flaky sea salt, plus more for sprinkling",
      "450 g unsalted butter (450 g)",
      "290 g light brown sugar (400 g)",
      "220 g granulated sugar (230 g)",
      "4 large eggs",
      "30 ml vanilla extract",
      "1.1 kg raisins or chopped dates",
    ],
  },
  {
    site: "pinchofyum.com",
    fixture: "pinchofyum-ginger-cookies.html",
    list: ".tasty-recipes-ingredients ul",
    items: ".tasty-recipes-ingredients li",
    steps: ".tasty-recipes-instructions li",
    ingredients: [
      "85 g of unsalted butter",
      "160 ml coconut sugar (or any brown sugar you have)",
      "55 g packed dark brown sugar",
      "10 ml vanilla",
      "1 egg",
      "150 g all purpose flour (160 g)",
      "5 ml ground ginger",
      "2.5 ml salt (a pinch more if you like)",
      "85 g chocolate chips (or chopped crystallised ginger)",
    ],
    convertedSteps: {},
    doubled: [
      "170 g of unsalted butter",
      "320 ml coconut sugar (or any brown sugar you have)",
      "110 g packed dark brown sugar",
      "20 ml vanilla",
      "2 egg",
      "300 g all purpose flour (320 g)",
      "10 ml ground ginger",
      "5 ml salt (a pinch more if you like)",
      "170 g chocolate chips (or chopped crystallised ginger)",
    ],
  },
  {
    site: "recipetineats.com",
    fixture: "recipetineats-cocoa-cake.html",
    list: "#recipe-707-ingredients ul",
    items: ".wprm-recipe-ingredient",
    steps: ".wprm-recipe-instruction",
    ingredients: [
      "▢ 240 g plain / all purpose flour",
      "▢ 40 g cocoa powder , unsweetened (Note 2)",
      "▢ 7.5 ml baking powder",
      "▢ 5 ml baking soda (bi-carb soda)",
      "▢ 300 g caster sugar (Note 1)",
      "▢ 2.5 ml salt",
      "▢ 3 eggs (~55-65g each)",
      "▢ 240 ml buttermilk (low or full fat)",
      "▢ 120 ml vegetable oil (or canola)",
      "▢ 10 ml vanilla extract",
      "▢ 240 ml boiling water",
      "▢ 1 1/2 batches Cream Cheese Frosting (slide scaler on recipe)",
    ],
    convertedSteps: {
      0: "Preheat oven to 170C° (150°C fan). Read Note 3 about rack positions.",
      1: "Grease 2 x 20cm round pans with butter and line the bases. (Note 4 on other pan sizes).",
    },
    doubled: [
      "▢ 480 g plain / all purpose flour",
      "▢ 85 g cocoa powder , unsweetened (Note 2)",
      "▢ 15 ml baking powder",
      "▢ 10 ml baking soda (bi-carb soda)",
      "▢ 590 g caster sugar (Note 1)",
      "▢ 5 ml salt",
      "▢ 6 eggs (~55-65g each)",
      "▢ 470 ml buttermilk (low or full fat)",
      "▢ 240 ml vegetable oil (or canola)",
      "▢ 20 ml vanilla extract",
      "▢ 470 ml boiling water",
      "▢ 3 batches Cream Cheese Frosting (slide scaler on recipe)",
    ],
  },
  {
    site: "tasty.co",
    fixture: "tasty-peanut-butter-cookies.html",
    list: ".ingredients__section ul",
    items: ".ingredients__section li",
    steps: "ol.prep-steps li",
    ingredients: [
      "130 g granulated sugar",
      "110 g brown sugar, packed",
      "2.5 ml salt",
      "170 g unsalted butter, melted",
      "2 large eggs",
      "10 ml vanilla extract",
      "185 g all-purpose flour",
      "5 ml baking soda",
      "170 g peanut butter chips",
      "85 g roasted peanuts, roughly chopped",
    ],
    convertedSteps: {
      4: "Preheat oven to 190°C. Line two baking sheets with parchment paper.",
      5: "Scoop the dough onto the sheets, leaving 7.5 cm between cookies and 2.5 cm from the edges.",
    },
    doubled: [
      "260 g granulated sugar",
      "220 g brown sugar, packed",
      "5 ml salt",
      "340 g unsalted butter, melted",
      "4 large eggs",
      "20 ml vanilla extract",
      "370 g all-purpose flour",
      "10 ml baking soda",
      "340 g peanut butter chips",
      "170 g roasted peanuts, roughly chopped",
    ],
  },
];

describe.each(SITES)("attach on $fixture ($site)", ({ fixture, list, items, steps, ingredients, convertedSteps, doubled }) => {
  const stepTexts = (doc: Document) => textsOf(doc, steps).map((text) => text.trim());

  it("detects the recipe and puts the scaling control directly above its ingredient list", () => {
    const doc = loadFixture(fixture);

    expect(attach(doc, settings)).not.toBeNull();

    expect(doc.querySelectorAll("sous-chefox-scale")).toHaveLength(1);
    expect(doc.querySelector("sous-chefox-scale")!.nextElementSibling).toBe(doc.querySelector(list));
  });

  it("rewrites every ingredient line", () => {
    const doc = loadFixture(fixture);

    attach(doc, settings);

    expect(textsOf(doc, items)).toEqual(ingredients);
  });

  it("converts the instructions and leaves the other steps as written", () => {
    const doc = loadFixture(fixture);
    const expected = stepTexts(loadFixture(fixture)).map((text, i) => convertedSteps[i] ?? text);

    attach(doc, settings);

    expect(stepTexts(doc)).toEqual(expected);
  });

  it("scales the ingredients to 2×", () => {
    const doc = loadFixture(fixture);

    attach(doc, settings)!.setScale(2);

    expect(textsOf(doc, items)).toEqual(doubled);
  });

  it("restores the original markup exactly on revert", () => {
    const doc = loadFixture(fixture);
    const before = doc.documentElement.outerHTML;
    const controller = attach(doc, settings)!;
    controller.setScale(2);

    controller.revert();

    expect(doc.documentElement.outerHTML).toBe(before);
  });
});

describe("attach on site-shaped pages it doesn't handle", () => {
  it("leaves a page that isn't a recipe unchanged (wikipedia.org)", () => {
    const doc = loadFixture("wikipedia-crepe.html");
    const before = doc.documentElement.outerHTML;

    expect(attach(doc, settings)).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("leaves the page unchanged when the ingredient list can't be located confidently (bonappetit.com)", () => {
    // Each amount and the rest of its line are separate elements, so no element holds a whole line.
    const doc = loadFixture("bonappetit-oat-cookies.html");
    const before = doc.documentElement.outerHTML;

    expect(attach(doc, settings)).toBeNull();
    expect(doc.documentElement.outerHTML).toBe(before);
  });

  it("converts an ingredient list rendered after the page loads (tasty.co)", async () => {
    const doc = loadFixture("tasty-peanut-butter-cookies.html");
    const list = doc.querySelector(".ingredients__section ul")!;
    const parent = list.parentElement!;
    list.remove();

    const attached = attachWhenReady(doc, settings);
    parent.append(list);

    expect(await attached).not.toBeNull();
    expect(doc.querySelector("sous-chefox-scale")!.nextElementSibling).toBe(list);
    expect(textsOf(doc, ".ingredients__section li")).toEqual(SITES.find((s) => s.site === "tasty.co")!.ingredients);
  });
});

describe("attach on Finnish recipe sites", () => {
  const finnish = { metric: true, siteDisabled: false, kitchen: true, decimals: true };
  // Lines read as their text, table cells apart, with runs of whitespace (newlines,
  // no-break spaces) as one space. Lidl puts each amount and its name in separate blocks
  // with nothing between them, so its lines read run together, as `textContent` sees them.
  const linesOf = (doc: Document, selector: string) =>
    [...doc.querySelectorAll(selector)].map((line) =>
      (line instanceof HTMLTableRowElement ? [...line.cells].map((cell) => cell.textContent).join(" ") : line.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim(),
    );
  const servings = (doc: Document) =>
    doc.querySelector("sous-chefox-scale")!.shadowRoot!.querySelector(".servings output")?.textContent ?? null;

  const realCheckVisibility = Element.prototype.checkVisibility;
  afterEach(() => {
    Element.prototype.checkVisibility = realCheckVisibility;
  });

  it.each([
    {
      site: "yhteishyva.fi",
      fixture: "fi-yhteishyva-kurkkusalaatti.html",
      list: "#recipe-information table",
      items: "#recipe-information > div > table tr:has(td)",
      servings: "4",
      doubled: [
        "800 g kurkkua",
        "2 kpl punasipuli",
        "2 kpl sitruuna",
        "1 kpl valkosipulinkynsi",
        "1 dl hienonnettua tilliä",
        "1 tl suolaa",
        "0.5 tl valkopippuria",
      ],
    },
    {
      site: "kotikokki.net",
      fixture: "fi-kotikokki-maustekeksit.html",
      list: "table.recipe-ingredients",
      items: "table.recipe-ingredients tr",
      servings: null,
      doubled: ["120 g voita", "2 dl fariinisokeria", "6 dl vehnäjauhoja", "2 rkl siirappia", "2 tl kanelia", "2 kananmuna"],
    },
    {
      site: "soppa365.fi",
      fixture: "fi-soppa365-pinaattipiirakka.html",
      list: ".recipe-items__container",
      items: ".recipe-items__container > div",
      servings: null,
      doubled: [
        "2 pkt (400 g) voitaikinaa",
        "TÄYTE",
        "2 tlk (2 dl) ruokakermaa, esim. laktoositon",
        "6 munaa",
        "300 g pakastepinaattia",
        "2 dl fetamurua, esim. 15 % rasvaa sisältävä",
        "1 tl suolaa",
        "2 rkl tuoretta tilliä tai 2 tl kuivattua",
        "PÄÄLLE",
        "rasia kirsikkatomaatteja",
        "1.5 dl auringonkukansiemeniä",
        "1 rkl oliiviöljyä",
      ],
    },
    {
      site: "reseptit.lidl.fi",
      fixture: "fi-lidl-uunilohi.html",
      list: "div.flex.flex-col.gap-4 ul",
      items: "div.flex.flex-col.gap-4 li",
      servings: "4",
      doubled: [
        "3 dlruokakermaa",
        "4 pktlohifileitä",
        "800 gperunoita",
        "1 kplsitruuna",
        "0.5 tlvalkopippuria",
        "400 gparsakaalia",
        "1 ruukkutilliä",
      ],
    },
  ])("finds the list on $site, reads its servings and scales it to 2× in the units it's written in", ({ fixture, list, items, servings: expected, doubled }) => {
    // Yhteishyvä has a print-only copy of the list, hidden on screen.
    Element.prototype.checkVisibility = function (this: Element) {
      return !this.closest(".print-view");
    };
    const doc = loadFixture(fixture);
    const before = linesOf(doc, items);

    const controller = attach(doc, finnish)!;

    expect(doc.querySelector("sous-chefox-scale")!.nextElementSibling).toBe(doc.querySelector(list));
    expect(linesOf(doc, items)).toEqual(before);
    expect(servings(doc)).toBe(expected);
    controller.setScale(2);
    expect(linesOf(doc, items)).toEqual(doubled);
  });

  it("skips a copy of the list the browser reports as hidden (yhteishyva.fi)", () => {
    Element.prototype.checkVisibility = function (this: Element) {
      return !this.closest(".print-view");
    };
    const doc = loadFixture("fi-yhteishyva-kurkkusalaatti.html");

    attach(doc, finnish);

    expect(doc.querySelector("sous-chefox-scale")!.closest(".print-view")).toBeNull();
  });
});

describe("attach on bbc.co.uk/food, with the list in sections", () => {
  const items = ".ssrcss-1fh8kfn-Wrapper li";
  const linesOf = (doc: Document) => textsOf(doc, items).map((text) => text.trim());

  it("converts the ingredient list, split into sections", () => {
    const doc = loadFixture("bbc-halloumi-tacos.html");

    attach(doc, settings);

    expect(doc.querySelector("sous-chefox-scale")!.nextElementSibling).toBe(doc.querySelector(".ssrcss-1fh8kfn-Wrapper"));
    expect(linesOf(doc)).toEqual([
      "250g halloumi, cut into 1½–2cm/½–¾in cubes",
      "30 ml runny honey",
      "15 ml cider vinegar",
      "15 ml olive oil",
      "½ orange, zest and juice",
      "small bunch fresh mint",
      "15g pickled red onion, plus 1 tbsp of the pickling liquid",
      "45 ml natural yoghurt",
      "¼ red cabbage, finely sliced",
      "8 small flour tortillas, warmed",
      "lime wedges, to serve",
      "hot sauce (optional)",
    ]);
  });

  it("scales to 2×, leaving sizes like 1½–2cm as written", () => {
    const doc = loadFixture("bbc-halloumi-tacos.html");

    attach(doc, settings)!.setScale(2);

    expect(linesOf(doc).slice(0, 2)).toEqual([
      "500 g halloumi, cut into 1½–2cm/½–¾in cubes",
      "60 ml runny honey",
    ]);
  });
});

describe("attachWhenReady on a site that re-renders the recipe after it loads", () => {
  const ingredients = ["2 cups rice", "1 tsp salt"];
  const converted = ["400 g rice", "5 ml salt"];

  /** What hydration does: the site's own markup comes back, without the control. */
  function rerender(doc: Document, original: string): void {
    doc.querySelector("sous-chefox-scale")?.remove();
    doc.querySelector("ul")!.outerHTML = original;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("converts the recipe again, with the control above it", async () => {
    vi.useFakeTimers();
    const doc = recipePage(ingredients);
    const original = doc.querySelector("ul")!.outerHTML;
    await attachWhenReady(doc, settings);

    rerender(doc, original);
    await vi.advanceTimersByTimeAsync(500);

    expect(textsOf(doc, "ul li")).toEqual(converted);
    expect(doc.querySelectorAll("sous-chefox-scale")).toHaveLength(1);
    expect(doc.querySelector("sous-chefox-scale")!.nextElementSibling).toBe(doc.querySelector("ul"));
  });

  it("returns a controller that follows the recipe through the re-render", async () => {
    vi.useFakeTimers();
    const doc = recipePage(ingredients);
    const original = doc.querySelector("ul")!.outerHTML;
    const controller = (await attachWhenReady(doc, settings))!;
    rerender(doc, original);
    await vi.advanceTimersByTimeAsync(500);

    controller.setSettings({ metric: false, siteDisabled: false });

    expect(textsOf(doc, "ul li")).toEqual(ingredients);
  });

  it("stops watching ten seconds after attaching", async () => {
    vi.useFakeTimers();
    const doc = recipePage(ingredients);
    const original = doc.querySelector("ul")!.outerHTML;
    await attachWhenReady(doc, settings);
    await vi.advanceTimersByTimeAsync(10_000);

    rerender(doc, original);
    await vi.advanceTimersByTimeAsync(500);

    expect(textsOf(doc, "ul li")).toEqual(ingredients);
    expect(doc.querySelector("sous-chefox-scale")).toBeNull();
  });
});

describe("halve and double buttons", () => {
  const fixture = "loveandlemons-banana-pancakes.html";
  const flour = ".wprm-recipe-ingredient";

  function control(doc: Document) {
    const root = doc.querySelector("sous-chefox-scale")!.shadowRoot!;
    const input = root.querySelector("input")!;
    return {
      input,
      halve: root.querySelector<HTMLButtonElement>("button.halve")!,
      double: root.querySelector<HTMLButtonElement>("button.double")!,
      type(value: string) {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      },
    };
  }

  it("doubles, and doubles again to quadruple", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    scale.double.click();
    scale.double.click();

    expect(scale.input.value).toBe("4");
    expect(textsOf(doc, flour)[0]).toBe("▢ 600 g bread flour");
  });

  it("halves, and halves again to quarter", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    scale.halve.click();
    scale.halve.click();

    expect(scale.input.value).toBe("0.25");
    expect(textsOf(doc, flour)[0]).toBe("▢ 40 g bread flour");
  });

  it("starts from the last valid factor while the input holds something invalid", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);
    scale.type("2");
    scale.type("2,,");

    scale.double.click();

    expect(scale.input.value).toBe("4");
    expect(scale.input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("sits − on the left of the input and + on the right", () => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    expect([scale.halve.textContent, scale.double.textContent]).toEqual(["−", "+"]);
    expect(scale.halve.nextElementSibling).toBe(scale.input);
    expect(scale.input.nextElementSibling).toBe(scale.double);
  });

  it.each([
    ["halving below 0.1", "0.15", "halve"],
    ["doubling past 20", "12", "double"],
  ] as const)("is disabled when %s", (_, typed, which) => {
    const doc = loadFixture(fixture);
    attach(doc, settings);
    const scale = control(doc);

    scale.type(typed);

    expect(scale[which].disabled).toBe(true);
    expect(scale[which === "halve" ? "double" : "halve"].disabled).toBe(false);
  });
});

describe("live Finnish kitchen units and decimals", () => {
  it("switches converted volumes between ml, decimals and fractions without a reload", () => {
    const doc = recipePage(["1 cup milk"]);
    const controller = attach(doc, settings)!;
    expect(textsOf(doc, "ul li")).toEqual(["240 ml milk"]);

    controller.setSettings({ ...settings, kitchen: true, decimals: true });
    expect(textsOf(doc, "ul li")).toEqual(["2.5 dl milk"]);

    controller.setSettings({ ...settings, kitchen: true, decimals: false });
    expect(textsOf(doc, "ul li")).toEqual(["2½ dl milk"]);
  });

  it("keeps the scale when the units change", () => {
    const doc = recipePage(["1 cup milk"]);
    const controller = attach(doc, settings)!;
    controller.setScale(2);

    controller.setSettings({ ...settings, kitchen: true, decimals: true });

    expect(textsOf(doc, "ul li")).toEqual(["4.5 dl milk"]);
  });
});
