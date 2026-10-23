/** Interface text for the control. The Firefox wrapper fills it from `browser.i18n`. */
export type Messages = {
  scaleLabel: string;
  scaleReset: string;
  scaleHint: string;
  scaleHalve: string;
  scaleDouble: string;
  servingsLabel: string;
  servingsFewer: string;
  servingsMore: string;
};

export const ENGLISH: Messages = {
  scaleLabel: "Scale",
  scaleReset: "Reset",
  scaleHint: "A number from 0.1 to 20",
  scaleHalve: "Halve",
  scaleDouble: "Double",
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
  /** Whether the control is still on the page, as a re-rendering site may remove it. */
  isConnected(): boolean;
}

const TAG = "sous-chefox-scale";


const STYLE = `
  :host { all: initial; display: block; margin: 0 0 0.75em; }
  .bar {
    display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.5em; padding: 0.3em 0.6em;
    box-sizing: border-box; max-width: 100%;
    font: 14px/1.4 system-ui, sans-serif; color: #222; background: #fff;
    border: 1px solid #ccc; border-radius: 6px;
  }
  .scale, .servings { display: inline-flex; align-items: center; gap: 0.4em; }
  output { min-width: 1.5em; text-align: center; }
  input, button { font: inherit; color: inherit; border: 1px solid #999; border-radius: 4px; }
  /* No spin buttons: the arrow keys step it, and − and + halve and double it. */
  input { width: 3em; padding: 0.1em 0.3em; text-align: center; background: #fff; appearance: textfield; }
  input::-webkit-inner-spin-button, input::-webkit-outer-spin-button { appearance: none; margin: 0; }
  /* Firefox's own glow would flag amounts off the arrow keys' steps, like 1.1. */
  input:user-invalid { box-shadow: none; }
  input[aria-invalid="true"] { border-color: #c00; background: #fee; outline-color: #c00; }
  button { padding: 0.1em 0.6em; background: #f3f3f3; cursor: pointer; }
  button:disabled { opacity: 0.4; cursor: default; }
  /* Big enough to tap on a phone. */
  @media (pointer: coarse) {
    input, button { min-height: 2.25em; }
    button { min-width: 2.25em; }
  }
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
 * anything else is highlighted and left exactly as typed. − and + halve and double the
 * last factor applied, as far as the range allows. Reset calls `onReset`.
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
  const scale = doc.createElement("span");
  scale.className = "scale";
  const label = doc.createElement("label");
  label.htmlFor = "multiplier";
  label.textContent = messages.scaleLabel;
  const input = doc.createElement("input");
  input.id = "multiplier";
  // A number input reads and shows decimals the way its language writes them ("1,5" in
  // Finnish). The arrow keys step by quarters: 0.25, 0.5, 0.75, 1, 1.25, 1.5 and so on.
  input.type = "number";
  input.lang = globalThis.navigator?.language ?? "";
  input.inputMode = "decimal";
  input.step = "0.25";
  input.min = "0.25";
  input.max = String(MAX_SCALE);
  input.title = messages.scaleHint;
  const halve = button(doc, "halve", "−", messages.scaleHalve);
  const double = button(doc, "double", "+", messages.scaleDouble);
  scale.append(label, halve, input, "×", double);
  const reset = button(doc, "reset", messages.scaleReset);
  const stepper = servings === null ? null : createStepper(doc, servings, messages, (factor) => {
    if (onScale(factor)) control.show(factor);
  });
  if (stepper) bar.append(stepper.element);
  bar.append(scale, reset);
  root.append(style, bar);

  const setInvalid = (invalid: boolean) => {
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  };
  // The last factor applied: what the halve and double buttons start from, even while
  // the input holds something invalid.
  let current = 1;
  const applied = (factor: number) => {
    current = factor;
    halve.disabled = !isValidScale(factor / 2);
    double.disabled = !isValidScale(factor * 2);
    stepper?.show(factor);
  };
  input.addEventListener("input", () => {
    // Text the input can't read as a number shows as typed but reads as "".
    const factor = input.validity.badInput ? null : parseMultiplier(input.value);
    setInvalid(factor === null);
    if (factor !== null && onScale(factor)) applied(factor);
  });
  const multiply = (by: number) => {
    if (onScale(current * by)) control.show(current * by);
  };
  halve.addEventListener("click", () => multiply(0.5));
  double.addEventListener("click", () => multiply(2));
  reset.addEventListener("click", onReset);

  const control: ScaleControl = {
    show(factor) {
      // A number input's value is always written with a point; it shows it localised.
      input.value = String(Math.round(factor * 100) / 100);
      setInvalid(false);
      applied(factor);
    },
    isConnected() {
      return host.isConnected;
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

/** A multiplier in range, from a number input's value ("1.5"), or null. */
function parseMultiplier(value: string): number | null {
  if (value.trim() === "") return null;
  const factor = Number(value);
  return isValidScale(factor) ? factor : null;
}
