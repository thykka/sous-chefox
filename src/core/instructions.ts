import { AMOUNT, AMOUNT_BOUNDARY, RANGE_SEPARATOR, parseAmount, parseAmounts } from "./amount";
import { formatLength, formatTemperature } from "./format";
import type { Replacement } from "./replacements";

// "350°F", "350 degrees F", or an F written straight onto the number ("375F").
const DEGREE = String.raw`\s*[°º˚]\s*|\s*[Dd]egrees?\s+|`;
const FAHRENHEIT = String.raw`(?:${DEGREE})(?:F|[Ff]ahrenheit)(?!\w)`;
// Some sites put the degree sign after the C: "180C°".
const CELSIUS = String.raw`(?:${DEGREE})(?:C|[Cc]elsius|[Cc]entigrade)(?!\w)(?:\s*[°º˚])?`;
const TEMPERATURE = new RegExp(
  String.raw`${AMOUNT_BOUNDARY}(${AMOUNT})(?:(?:${RANGE_SEPARATOR})(${AMOUNT}))?(?:(${FAHRENHEIT})|${CELSIUS})`,
  "g",
);

// "9-inch", "2 inches", "9″", or an inch mark straight after the number ('10"', "10”").
const INCH = String.raw`(?:\s*-?\s*(?:inch(?:es)?|″)|["”])(?!\w)`;
const BY = String.raw`\s*(?:[x×X]|by)\s*`;
// A pan size written without a unit ("an 8x8 baking dish") is in inches.
const PAN = String.raw`(?=\s+(?:[\w-]+\s+){0,2}(?:pans?|dish(?:es)?|tins?|skillets?|casseroles?|baking\s+sheets?)(?!\w))`;
const LENGTH = new RegExp(
  [
    String.raw`${AMOUNT_BOUNDARY}(${AMOUNT})${BY}(${AMOUNT})(?:${BY}(${AMOUNT}))?(?:${INCH}|${PAN})`,
    String.raw`${AMOUNT_BOUNDARY}(${AMOUNT})(?:(?:${RANGE_SEPARATOR})(${AMOUNT}))?${INCH}`,
  ].join("|"),
  "gi",
);

// A length the site gave in metric next to the inches: "4 inches (10 cm)", "22cm/9\"".
const METRIC_LENGTH = new RegExp(
  String.raw`${AMOUNT_BOUNDARY}(?:${AMOUNT})(?:(?:${RANGE_SEPARATOR})(?:${AMOUNT}))?\s*(?:cm|mm)(?!\w)`,
  "g",
);

// How a metric figure sits next to an imperial one: "350°F (175°C)", "180°C/350°F".
const PAIR_OPEN = /^\s*[([/]\s*$/;
const PAIR_CLOSE = /^\s*[)\]]/;

type Temperature = { start: number; end: number; fahrenheit: number[] | null };

/**
 * Oven temperatures and inch lengths or pan sizes in a piece of instruction text,
 * converted to metric. Instructions are never scaled.
 */
export function findInstructionReplacements(text: string, locale?: string): Replacement[] {
  return [...temperatureReplacements(text, locale), ...lengthReplacements(text, locale)].sort(
    (a, b) => a.start - b.start,
  );
}

/** °F as °C. A °C figure the site gave next to it is shown in its place, as written. */
function temperatureReplacements(text: string, locale?: string): Replacement[] {
  const temperatures: Temperature[] = [];
  for (const match of text.matchAll(TEMPERATURE)) {
    temperatures.push({
      start: match.index,
      end: match.index + match[0].length,
      fahrenheit: match[3] === undefined ? null : parseAmounts(match[1]!, match[2]),
    });
  }
  const replacements: Replacement[] = [];
  for (let i = 0; i < temperatures.length; i++) {
    const first = temperatures[i]!;
    const second = temperatures[i + 1];
    if (second && (first.fahrenheit === null) !== (second.fahrenheit === null)) {
      if (PAIR_OPEN.test(text.slice(first.end, second.start))) {
        const end = pairEnd(text, first.end, second.start, second.end);
        if (end !== null) {
          const celsius = first.fahrenheit === null ? first : second;
          replacements.push({ start: first.start, end, text: text.slice(celsius.start, celsius.end) });
          i++;
          continue;
        }
      }
    }
    if (first.fahrenheit) {
      const celsius = first.fahrenheit.map((f) => ((f - 32) * 5) / 9);
      replacements.push({ start: first.start, end: first.end, text: formatTemperature(celsius, locale) });
    }
  }
  return replacements;
}

/**
 * Inch lengths ("¼ inch"), ranges of them, and pan sizes ("9×13-inch") in cm or mm. A
 * metric length the site gave next to one is shown in its place, as written.
 */
function lengthReplacements(text: string, locale?: string): Replacement[] {
  const replacements: Replacement[] = [];
  const metric = [...text.matchAll(METRIC_LENGTH)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
  for (const match of text.matchAll(LENGTH)) {
    const [, width, depth, height, low, high] = match;
    const inches =
      width !== undefined
        ? [width, depth!, height].filter((side) => side !== undefined).map(parseAmount)
        : parseAmounts(low!, high);
    if (!inches || inches.some((inch) => inch === null)) continue;
    const start = match.index;
    const end = start + match[0].length;
    const before = metric.find((m) => m.end <= start && /^\s*\/\s*$/.test(text.slice(m.end, start)));
    const after = metric.find((m) => m.start >= end && PAIR_OPEN.test(text.slice(end, m.start)));
    const afterEnd = after ? pairEnd(text, end, after.start, after.end) : null;
    if (before) {
      replacements.push({ start: before.start, end, text: text.slice(before.start, before.end) });
    } else if (after && afterEnd !== null) {
      replacements.push({ start, end: afterEnd, text: text.slice(after.start, after.end) });
    } else {
      const cm = (inches as number[]).map((inch) => inch * 2.54);
      replacements.push({ start, end, text: formatLength(cm, width !== undefined ? "×" : "–", locale) });
    }
  }
  return replacements;
}

/**
 * Where two figures written side by side end: at the second after a slash, past its
 * closing bracket otherwise. Null when the bracket is never closed.
 */
function pairEnd(text: string, firstEnd: number, secondStart: number, secondEnd: number): number | null {
  if (text.slice(firstEnd, secondStart).includes("/")) return secondEnd;
  const close = text.slice(secondEnd).match(PAIR_CLOSE);
  return close ? secondEnd + close[0].length : null;
}
