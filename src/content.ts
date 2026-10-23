import { attachToSelection, attachWhenReady, type RecipeController } from "./core/attach";
import type { Messages } from "./core/scaleControl";
import { CONVERT_SELECTION } from "./messages";
import { loadSettings, onSettingsChanged, siteSettings, type StoredSettings } from "./settings";

const messages: Messages = {
  scaleLabel: browser.i18n.getMessage("scaleLabel"),
  scaleReset: browser.i18n.getMessage("scaleReset"),
  scaleHint: browser.i18n.getMessage("scaleHint"),
  servingsLabel: browser.i18n.getMessage("servingsLabel"),
  servingsFewer: browser.i18n.getMessage("servingsFewer"),
  servingsMore: browser.i18n.getMessage("servingsMore"),
};

let stored: StoredSettings | null = null;
let controller: RecipeController | null = null;
// Whether the page is being watched for an ingredient list rendered late.
let watching = false;
// Selections converted from the context menu, for this page load only.
const manual: RecipeController[] = [];

const currentSettings = () => siteSettings(stored!, location.hostname);

function attachToPage(): void {
  watching = true;
  void attachWhenReady(document, currentSettings(), messages).then((attached) => {
    watching = false;
    controller = attached;
    // Settings may have changed while the page was watched.
    controller?.setSettings(currentSettings());
  });
}

void loadSettings().then((loaded) => {
  stored = loaded;
  attachToPage();
  // A page that started disabled is attached once it's enabled.
  onSettingsChanged((changed) => {
    stored = changed;
    const settings = currentSettings();
    for (const selected of manual) selected.setSettings(settings);
    if (controller) controller.setSettings(settings);
    else if (!watching) attachToPage();
  });
});

browser.runtime.onMessage.addListener((message: unknown) => {
  if ((message as { type?: unknown } | null)?.type !== CONVERT_SELECTION || !stored) return;
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const selected = attachToSelection(document, selection.getRangeAt(0), currentSettings(), messages);
  if (selected) manual.push(selected);
});
