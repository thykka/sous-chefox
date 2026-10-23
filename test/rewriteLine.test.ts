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
    ["Honey, 2 tbsp", "Honey, 30 ml"],
    ["4 cups water - divided", "950 ml water - divided"],
  ])("%s → %s", (line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });
});

describe("rewriteLine parses every way of writing an amount", () => {
  it.each([
    ["ascii fraction", "1/2 cup honey", "120 ml honey"],
    ["fraction slash", "1⁄2 cup honey", "120 ml honey"],
    ["unicode fraction", "½ cup honey", "120 ml honey"],
    ["mixed number", "1 1/2 cups stock", "350 ml stock"],
    ["mixed number with hyphen", "1-1/2 cups stock", "350 ml stock"],
    ["mixed unicode fraction", "1½ cups stock", "350 ml stock"],
    ["spaced unicode fraction", "1 ½ cups stock", "350 ml stock"],
    ["decimal", "1.5 cups stock", "350 ml stock"],
    ["leading-dot decimal", ".5 cup honey", "120 ml honey"],
    ["thirds", "⅓ cup oil", "80 ml oil"],
    ["eighths", "⅞ cup oil", "210 ml oil"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });
});

describe("rewriteLine converts every US customary unit", () => {
  it.each([
    ["teaspoon abbreviation with dot", "1 tsp. salt", "5 ml salt"],
    ["capitalised tablespoon", "1 Tbsp oil", "15 ml oil"],
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

describe("rewriteLine weighs dry ingredients", () => {
  it.each([
    ["flour", "1 cup all-purpose flour", "120 g all-purpose flour"],
    ["plain flour", "2 cups flour", "240 g flour"],
    ["whole wheat flour", "1 cup whole wheat flour", "110 g whole wheat flour"],
    ["sugar", "1 cup granulated sugar", "200 g granulated sugar"],
    ["spoon of sugar", "2 tbsp cane sugar", "25 g cane sugar"],
    ["powdered sugar", "½ cup powdered sugar", "55 g powdered sugar"],
    ["butter", "½ cup unsalted butter, softened", "110 g unsalted butter, softened"],
    ["oats", "1 cup old-fashioned rolled oats", "90 g old-fashioned rolled oats"],
    ["rice", "1 cup long-grain white rice", "200 g long-grain white rice"],
    ["cocoa", "⅔ cup cocoa powder (sifted if lumpy)", "55 g cocoa powder (sifted if lumpy)"],
    ["cornstarch", "2 tbsp cornstarch", "14 g cornstarch"],
    ["chocolate chips", "½ cup dark chocolate chips", "85 g dark chocolate chips"],
    ["ingredient named first", "Flour, 1 cup", "Flour, 120 g"],
    ["preparation words", "1 cup all-purpose flour, sifted", "120 g all-purpose flour, sifted"],
    ["apostrophe in a name", "1 cup confectioners' sugar, sifted", "110 g confectioners' sugar, sifted"],
    ["longest name wins", "1 cup brown sugar", "150 g brown sugar"],
    ["longer flour name wins", "1 cup almond flour", "95 g almond flour"],
    ["range", "2-3 cups flour", "240–360 g flour"],
    ["compound", "1 cup plus 2 tbsp flour", "140 g flour"],
    ["weight stays weight", "8 oz flour", "230 g flour"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });

  it.each([
    ["loose by default", "1 cup brown sugar", "150 g brown sugar"],
    ["packed", "1 cup packed brown sugar", "220 g packed brown sugar"],
    ["packed after the name", "1 cup light brown sugar, firmly packed", "220 g light brown sugar, firmly packed"],
    ["packed with no packed figure", "1 cup packed flour", "120 g packed flour"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });

  it.each([
    ["unknown ingredient", "1 cup blueberries", "240 ml blueberries"],
    ["liquid", "1 cup milk", "240 ml milk"],
    ["two ingredients", "2 tablespoons avocado oil or melted butter", "30 ml avocado oil or melted butter"],
    ["look-alike of butter", "½ cup peanut butter", "120 ml peanut butter"],
    ["look-alike of flour", "1 cup rice flour", "240 ml rice flour"],
    ["look-alike of sugar", "1 cup coconut sugar", "240 ml coconut sugar"],
    ["word containing a name", "1 cup buttermilk", "240 ml buttermilk"],
    ["cooked", "2 cups cooked rice", "470 ml cooked rice"],
  ])("falls back to ml: %s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });
});

describe("rewriteLine converts sticks of butter", () => {
  it.each([
    ["one stick", "1 stick butter", "113 g butter"],
    ["two sticks", "2 sticks unsalted butter, softened", "226 g unsalted butter, softened"],
    ["half a stick", "½ stick butter", "57 g butter"],
    ["stick plus spoons", "1 stick plus 2 tbsp butter", "140 g butter"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });

  it.each([
    ["not butter", "1 stick cinnamon"],
    ["butter look-alike", "1 stick peanut butter"],
  ])("leaves the line unchanged: %s: %s", (_, line) => {
    expect(rewriteLine(line, metric)).toBeNull();
  });
});

describe("rewriteLine reads oz as weight unless it's fluid", () => {
  it.each([
    ["solid", "8 oz cheese", "230 g cheese"],
    ["fl oz", "8 fl oz milk", "240 ml milk"],
    ["liquid", "8 oz milk", "240 ml milk"],
    ["liquid stock", "16 ounces chicken stock", "470 ml chicken stock"],
    ["liquid juice", "2 oz lime juice", "60 ml lime juice"],
    ["liquid look-alike", "8 oz cream cheese", "230 g cream cheese"],
    ["milk chocolate", "4 oz milk chocolate", "110 g milk chocolate"],
    ["dry ingredient", "4 oz butter", "110 g butter"],
  ])("%s: %s → %s", (_, line, expected) => {
    expect(rewriteLine(line, metric)).toBe(expected);
  });
});
