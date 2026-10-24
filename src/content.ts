import { attach, attachToSelection, attachWhenReady, type RecipeController } from "./core/attach";
import type { Messages } from "./core/scaleControl";
import { CONVERT_PAGE, CONVERT_SELECTION } from "./messages";
import { loadSettings, onSettingsChanged, siteSettings, type StoredSettings } from "./settings";

const messages: Messages = {
  scaleLabel: browser.i18n.getMessage("scaleLabel"),
  scaleReset: browser.i18n.getMessage("scaleReset"),
  scaleHint: browser.i18n.getMessage("scaleHint"),
  scaleHalve: browser.i18n.getMessage("scaleHalve"),
  scaleDouble: browser.i18n.getMessage("scaleDouble"),
  servingsLabel: browser.i18n.getMessage("servingsLabel"),
  servingsFewer: browser.i18n.getMessage("servingsFewer"),
  servingsMore: browser.i18n.getMessage("servingsMore"),
};

let stored: StoredSettings | null = null;
let controller: RecipeController | null = null;
// The watch for an ingredient list rendered late, while it runs.
let watching: Promise<RecipeController | null> | null = null;
// Whether the popup asked for this page to be converted, which holds with "Convert
// automatically" off.
let requested = false;
// Selections converted from the context menu, for this page load only.
const manual: RecipeController[] = [];

const currentSettings = () => siteSettings(stored!, location.hostname);

function attachToPage(): Promise<RecipeController | null> {
  watching = attachWhenReady(document, currentSettings(), messages).then((attached) => {
    watching = null;
    controller = attached;
    // Settings may have changed while the page was watched.
    controller?.setSettings(currentSettings());
    return attached;
  });
  return watching;
}

void loadSettings().then((loaded) => {
  stored = loaded;
  if (stored.auto) void attachToPage();
  // A page that started disabled, or before "Convert automatically" was on, is attached
  // once that changes.
  onSettingsChanged((changed) => {
    stored = changed;
    const settings = currentSettings();
    for (const selected of manual) selected.setSettings(settings);
    // The page is watched for a late list only once, after it loads.
    if (controller) controller.setSettings(settings);
    else if (!watching && (stored.auto || requested)) controller = attach(document, settings, messages);
  });
});

browser.runtime.onMessage.addListener((message: unknown) => {
  const type = (message as { type?: unknown } | null)?.type;
  if (type === CONVERT_PAGE && stored) {
    requested = true;
    if (controller) return Promise.resolve({ found: true });
    return (watching ?? attachToPage()).then((attached) => ({ found: attached !== null }));
  }
  if (type !== CONVERT_SELECTION || !stored) return;
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const selected = attachToSelection(document, selection.getRangeAt(0), currentSettings(), messages);
  if (!selected) return;
  manual.push(selected);
  // The selection has done its job; left in place it would hide the converted lines.
  selection.removeAllRanges();
});
