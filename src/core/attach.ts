import { detectRecipe } from "./detectRecipe";
import { findInstructionReplacements } from "./instructions";
import { locateList } from "./locateList";
import { lineText, linesOf, rewriteLines } from "./pageRewriter";
import { findReplacements, hasAmount, isMetricRecipe } from "./replacements";
import { createScaleControl, ENGLISH, isValidScale, type Messages, type ScaleControl } from "./scaleControl";
import { selectedLines } from "./selection";
import { parseServings } from "./servings";
import { textLinesOf } from "./visibleText";

/**
 * What the user chose. `kitchen` writes converted volumes in Finnish kitchen units
 * (dl, rkl, tl) and `decimals` writes amounts as "0,5" rather than "½"; both are off
 * unless given, and the Firefox wrapper always gives them.
 */
export type Settings = { metric: boolean; siteDisabled: boolean; kitchen?: boolean; decimals?: boolean };

export interface RecipeController {
  /** Same effect as using the scaling control. */
  setScale(factor: number): void;
  /** Re-renders live, or reverts fully when the site is disabled. */
  setSettings(settings: Settings): void;
  /** Restores every original exactly and removes the control. */
  revert(): void;
}

/** A controller that can tell whether its rewrite is still on the page. */
type Controller = RecipeController & { isConnected(): boolean };

/** Converts the page's recipe in place, or returns null when the page isn't handled. */
export function attach(doc: Document, settings: Settings, messages: Messages = ENGLISH): RecipeController | null {
  return attachController(doc, settings, messages);
}

function attachController(doc: Document, settings: Settings, messages: Messages): Controller | null {
  if (settings.siteDisabled) return null;
  const recipe = detectRecipe(doc);
  if (!recipe) return null;
  const list = locateList(doc, recipe.ingredients);
  if (!list || linesOf(list).some(isManaged)) return null;
  const instructions = locateList(doc, recipe.instructions);
  const steps =
    instructions &&
    !instructions.contains(list) &&
    !list.contains(instructions) &&
    !linesOf(instructions).some(isManaged)
      ? instructions
      : null;
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

/** How long a recipe page is watched for an ingredient list rendered after it loads. */
const WATCH_MS = 4000;
/** The gap before the first try at attaching after the page changes; it doubles after each try. */
const RETRY_MS = 100;
/** The most tries at attaching one watch makes: each searches the whole page. */
const MAX_TRIES = 5;

/** How long after attaching the page is watched for a site re-rendering the recipe. */
const REATTACH_MS = 10000;

/**
 * Like `attach`, but when a recipe page's ingredient list isn't there yet, watches the
 * page for a few seconds in case it's rendered late, then stops for good. Once attached,
 * it keeps watching a while longer: sites that render on the server and then hydrate
 * (React, as on bbc.co.uk) re-render a recipe they didn't write themselves, throwing the
 * rewrite away, so it's attached again to the new markup.
 */
export function attachWhenReady(
  doc: Document,
  settings: Settings,
  messages: Messages = ENGLISH,
): Promise<RecipeController | null> {
  return waitForList(doc, settings, messages).then(
    (controller) => controller && keepAttached(doc, controller, settings, messages),
  );
}

/**
 * A controller that follows the recipe through re-renders for `REATTACH_MS`: whenever
 * the rewrite disappears from the page, the recipe is attached again with the latest
 * settings, at 1×.
 */
function keepAttached(doc: Document, first: Controller, settings: Settings, messages: Messages): RecipeController {
  let current = first;
  let latest = settings;
  const view = doc.defaultView ?? globalThis;
  const stop = watchChanges(doc, false, () => {
    if (current.isConnected()) return null;
    current.revert();
    current = attachController(doc, latest, messages) ?? current;
    return false;
  });
  view.setTimeout(stop, REATTACH_MS);
  return {
    setScale: (factor) => current.setScale(factor),
    setSettings(next) {
      latest = next;
      current.setSettings(next);
    },
    revert() {
      stop();
      current.revert();
    },
  };
}

function waitForList(doc: Document, settings: Settings, messages: Messages): Promise<Controller | null> {
  const controller = attachController(doc, settings, messages);
  if (controller || settings.siteDisabled || !detectRecipe(doc) || !doc.body) return Promise.resolve(controller);
  const view = doc.defaultView ?? globalThis;
  return new Promise((resolve) => {
    let attached: Controller | null = null;
    const finish = () => {
      stop();
      view.clearTimeout(deadline);
      resolve(attached);
    };
    const stop = watchChanges(doc, true, () => {
      attached = attachController(doc, settings, messages);
      if (attached) finish();
      return attached !== null;
    }, finish);
    const deadline = view.setTimeout(finish, WATCH_MS);
  });
}

/**
 * Tries again whenever the page changes, so a recipe that's rendered or re-rendered late
 * is still found, but gently: each try waits for the page to settle, a gap that doubles
 * after every try, and then for the browser to be idle, and after `MAX_TRIES` the watch
 * stops (calling `onGiveUp`). `attempt` returns true when it's done, false for a try that
 * didn't get there, and null when there was nothing to try. Returns a function that stops
 * the watch.
 */
function watchChanges(doc: Document, characterData: boolean, attempt: () => boolean | null, onGiveUp = () => {}): () => void {
  const view = doc.defaultView ?? globalThis;
  let gap = RETRY_MS;
  let tries = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const run = () => {
    timer = null;
    if (stopped) return;
    const result = attempt();
    if (result === null) return;
    if (result || ++tries >= MAX_TRIES) {
      stop();
      if (!result) onGiveUp();
    } else {
      gap *= 2;
    }
  };
  const observer = new view.MutationObserver(() => {
    timer ??= view.setTimeout(() => whenIdle(view, run), gap);
  });
  const stop = () => {
    stopped = true;
    observer.disconnect();
    if (timer !== null) view.clearTimeout(timer);
  };
  observer.observe(doc.body!, { childList: true, subtree: true, characterData });
  return stop;
}

// jsdom has no requestIdleCallback, so there the try runs straight away.
function whenIdle(view: Window | typeof globalThis, run: () => void): void {
  if (typeof view.requestIdleCallback === "function") view.requestIdleCallback(run, { timeout: 1000 });
  else run();
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
  // A selection from a list's first item gets the control above the list itself, so it
  // sits directly above the selection without landing inside the list.
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

function createController(target: Target, initial: Settings, messages: Messages): Controller {
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
    // A recipe that's already metric is only ever scaled, in the units it's written in,
    // so its spoons stay spoons.
    const options = {
      scale,
      metric: settings.metric && !target.metricRecipe,
      kitchen: settings.kitchen ?? false,
      decimals: settings.decimals ?? false,
    };
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
    // A disabled site has nothing on the page to lose; a reverted controller has lost it.
    isConnected: () => !reverted && (control === null ? settings.siteDisabled : control.isConnected() && target.anchor.isConnected),
    setSettings(next) {
      if (reverted) return;
      const formatChanged =
        next.metric !== settings.metric || next.kitchen !== settings.kitchen || next.decimals !== settings.decimals;
      settings = next;
      if (next.siteDisabled) {
        unmount();
      } else if (!control) {
        mount();
      } else if (formatChanged) {
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
