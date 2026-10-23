import { attach } from "./core/attach";
import type { Messages } from "./core/scaleControl";

const messages: Messages = {
  scaleLabel: browser.i18n.getMessage("scaleLabel"),
  scaleReset: browser.i18n.getMessage("scaleReset"),
  scaleHint: browser.i18n.getMessage("scaleHint"),
};

// Settings storage and the popup arrive with the settings ticket; until then use the defaults.
attach(document, { metric: true, siteDisabled: false }, messages);
