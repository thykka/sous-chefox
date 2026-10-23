/** Interface text for the control. The Firefox wrapper fills it from `browser.i18n`. */
export type Messages = {
  scaleLabel: string;
  scaleReset: string;
  scaleHint: string;
  servingsLabel: string;
  servingsFewer: string;
  servingsMore: string;
};

export const ENGLISH: Messages = {
  scaleLabel: "Scale",
  scaleReset: "Reset",
  scaleHint: "A number from 0.1 to 20",
  servingsLabel: "Servings",
  servingsFewer: "Fewer servings",
  servingsMore: "More servings",
};

const MIN_SCALE = 0.1;
const MAX_SCALE = 20;

export function isValidScale(factor: number): boolean {
  return Number.isFinite(factor) && factor >= MIN_SCALE && factor <= MAX_SCALE;
}

export interface ScaleControl {
  /** Shows `factor` in the input, replacing whatever was typed, and in the stepper. */
  show(factor: number): void;
  remove(): void;
}

const TAG = "sous-chefox-scale";

// A decimal with either separator, so "1,5" and "1.5" both work in any locale.
const DECIMAL = /^\s*(\d+(?:[.,]\d+)?|[.,]\d+)\s*$/;

const STYLE = `
  :host { all: initial; display: block; margin: 0 0 0.75em; }
  .bar {
    display: inline-flex; align-items: center; gap: 0.5em; padding: 0.3em 0.6em;
    font: 14px/1.4 system-ui, sans-serif; color: #222; background: #fff;
    border: 1px solid #ccc; border-radius: 6px;
  }
  label, .servings { display: inline-flex; align-items: center; gap: 0.4em; }
  output { min-width: 1.5em; text-align: center; }
  input, button { font: inherit; color: inherit; border: 1px solid #999; border-radius: 4px; }
  input { width: 4em; padding: 0.1em 0.3em; background: #fff; }
  input[aria-invalid="true"] { border-color: #c00; background: #fee; outline-color: #c00; }
  button { padding: 0.1em 0.6em; background: #f3f3f3; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
  @media (prefers-color-scheme: dark) {
    .bar { color: #eee; background: #222; border-color: #555; }
    input { background: #111; }
    input[aria-invalid="true"] { border-color: #f66; background: #400; }
    button { background: #333; }
  }
`;

export type ScaleControlOptions = {
  messages: Messages;
  /** The recipe's servings at 1×, or null to show the multiplier only. */
  servings: number | null;
  /** Applies a scale factor; false when it wasn't applied. */
  onScale: (factor: number) => boolean;
  onReset: () => void;
};

/**
 * The scaling control, in a shadow root directly above `anchor` so the site's styles
 * can't reach it. One scale factor drives it: the stepper shows the servings it gives
 * and the multiplier shows the factor itself. A valid multiplier calls `onScale`;
 * anything else is highlighted and left exactly as typed. Reset calls `onReset`.
 */
export function createScaleControl(anchor: Element, options: ScaleControlOptions): ScaleControl {
  const { messages, servings, onScale, onReset } = options;
  const doc = anchor.ownerDocument;
  const host = doc.createElement(TAG);
  const root = host.attachShadow({ mode: "open" });

  const style = doc.createElement("style");
  style.textContent = STYLE;
  const bar = doc.createElement("div");
  bar.className = "bar";
  const label = doc.createElement("label");
  const input = doc.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.title = messages.scaleHint;
  label.append(messages.scaleLabel, input, "×");
  const reset = button(doc, "reset", messages.scaleReset);
  const stepper = servings === null ? null : createStepper(doc, servings, messages, (factor) => {
    if (onScale(factor)) control.show(factor);
  });
  if (stepper) bar.append(stepper.element);
  bar.append(label, reset);
  root.append(style, bar);

  const setInvalid = (invalid: boolean) => {
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  };
  input.addEventListener("input", () => {
    const factor = parseMultiplier(input.value);
    setInvalid(factor === null);
    if (factor !== null && onScale(factor)) stepper?.show(factor);
  });
  reset.addEventListener("click", onReset);

  const format = new Intl.NumberFormat(globalThis.navigator?.language, { maximumFractionDigits: 2, useGrouping: false });
  const control: ScaleControl = {
    show(factor) {
      input.value = format.format(factor);
      setInvalid(false);
      stepper?.show(factor);
    },
    remove() {
      host.remove();
    },
  };
  control.show(1);
  anchor.before(host);
  return control;
}

/**
 * "− 4 +": the servings at the current factor, stepping to the next whole number of
 * servings either way, as far as the scale's range allows.
 */
function createStepper(doc: Document, servings: number, messages: Messages, onStep: (factor: number) => void) {
  const element = doc.createElement("span");
  element.className = "servings";
  const output = doc.createElement("output");
  const fewer = button(doc, "fewer", "−", messages.servingsFewer);
  const more = button(doc, "more", "+", messages.servingsMore);
  element.append(messages.servingsLabel, fewer, output, more);

  const format = new Intl.NumberFormat(globalThis.navigator?.language, { maximumFractionDigits: 1, useGrouping: false });
  // A tolerance, so 4 × 1.25 counts as exactly 5 servings.
  const EPSILON = 1e-9;
  let current = servings;
  const fewerFactor = () => (Math.ceil(current - EPSILON) - 1) / servings;
  const moreFactor = () => (Math.floor(current + EPSILON) + 1) / servings;
  fewer.addEventListener("click", () => onStep(fewerFactor()));
  more.addEventListener("click", () => onStep(moreFactor()));

  return {
    element,
    show(factor: number) {
      current = servings * factor;
      output.textContent = format.format(current);
      fewer.disabled = Math.ceil(current - EPSILON) - 1 < 1 || !isValidScale(fewerFactor());
      more.disabled = !isValidScale(moreFactor());
    },
  };
}

function button(doc: Document, className: string, text: string, label?: string): HTMLButtonElement {
  const el = doc.createElement("button");
  el.type = "button";
  el.className = className;
  el.textContent = text;
  if (label !== undefined) {
    el.title = label;
    el.setAttribute("aria-label", label);
  }
  return el;
}

/** A typed multiplier in range, or null. */
function parseMultiplier(text: string): number | null {
  const match = text.match(DECIMAL);
  if (!match) return null;
  const factor = Number(match[1]!.replace(",", "."));
  return isValidScale(factor) ? factor : null;
}
