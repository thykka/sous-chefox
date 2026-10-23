import { attach, type RecipeController } from "./core/attach";
import type { Messages } from "./core/scaleControl";
import { loadSettings, onSettingsChanged, siteSettings } from "./settings";

const messages: Messages = {
  scaleLabel: browser.i18n.getMessage("scaleLabel"),
  scaleReset: browser.i18n.getMessage("scaleReset"),
  scaleHint: browser.i18n.getMessage("scaleHint"),
  servingsLabel: browser.i18n.getMessage("servingsLabel"),
  servingsFewer: browser.i18n.getMessage("servingsFewer"),
  servingsMore: browser.i18n.getMessage("servingsMore"),
};

let controller: RecipeController | null = null;

void loadSettings().then((stored) => {
  controller = attach(document, siteSettings(stored, location.hostname), messages);
  // A page that started disabled is attached once it's enabled.
  onSettingsChanged((changed) => {
    const settings = siteSettings(changed, location.hostname);
    if (controller) controller.setSettings(settings);
    else controller = attach(document, settings, messages);
  });
});
