import { attach } from "./core/attach";

// Settings storage and the popup arrive with the settings ticket; until then use the defaults.
attach(document, { metric: true, siteDisabled: false });
