/** Interface text for the control. The Firefox wrapper fills it from `browser.i18n`. */
export type Messages = { scaleLabel: string; scaleReset: string; scaleHint: string };

export const ENGLISH: Messages = {
  scaleLabel: "Scale",
  scaleReset: "Reset",
  scaleHint: "A number from 0.1 to 20",
};

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 20;

export function isValidScale(factor: number): boolean {
  return Number.isFinite(factor) && factor >= MIN_SCALE && factor <= MAX_SCALE;
}

export interface ScaleControl {
  /** Shows `factor` in the input, replacing whatever was typed. */
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
  label { display: inline-flex; align-items: center; gap: 0.4em; }
  input, button { font: inherit; color: inherit; border: 1px solid #999; border-radius: 4px; }
  input { width: 4em; padding: 0.1em 0.3em; background: #fff; }
  input[aria-invalid="true"] { border-color: #c00; background: #fee; outline-color: #c00; }
  button { padding: 0.1em 0.6em; background: #f3f3f3; cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    .bar { color: #eee; background: #222; border-color: #555; }
    input { background: #111; }
    input[aria-invalid="true"] { border-color: #f66; background: #400; }
    button { background: #333; }
  }
`;

/**
 * The scaling control, in a shadow root directly above `list` so the site's styles
 * can't reach it. A valid multiplier calls `onScale`; anything else is highlighted and
 * left exactly as typed. Reset calls `onReset`.
 */
export function createScaleControl(
  list: Element,
  messages: Messages,
  onScale: (factor: number) => void,
  onReset: () => void,
): ScaleControl {
  const doc = list.ownerDocument;
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
  const reset = doc.createElement("button");
  reset.type = "button";
  reset.textContent = messages.scaleReset;
  bar.append(label, reset);
  root.append(style, bar);

  const setInvalid = (invalid: boolean) => {
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  };
  input.addEventListener("input", () => {
    const factor = parseMultiplier(input.value);
    setInvalid(factor === null);
    if (factor !== null) onScale(factor);
  });
  reset.addEventListener("click", onReset);

  const format = new Intl.NumberFormat(globalThis.navigator?.language, { maximumFractionDigits: 2, useGrouping: false });
  const control: ScaleControl = {
    show(factor) {
      input.value = format.format(factor);
      setInvalid(false);
    },
    remove() {
      host.remove();
    },
  };
  control.show(1);
  list.before(host);
  return control;
}

/** A typed multiplier in range, or null. */
function parseMultiplier(text: string): number | null {
  const match = text.match(DECIMAL);
  if (!match) return null;
  const factor = Number(match[1]!.replace(",", "."));
  return isValidScale(factor) ? factor : null;
}
