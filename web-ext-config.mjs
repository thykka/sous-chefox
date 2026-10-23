import { existsSync } from "node:fs";

// Release Firefox often lags behind the manifest's strict_min_version, so `web-ext run`
// prefers Developer Edition where it's installed. `--firefox` or WEB_EXT_FIREFOX still win.
const DEVELOPER_EDITION = {
  darwin: "/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox",
  win32: "C:\\Program Files\\Firefox Developer Edition\\firefox.exe",
  linux: "/usr/bin/firefox-developer-edition",
}[process.platform];

const developerEdition =
  !process.env.WEB_EXT_FIREFOX && DEVELOPER_EDITION && existsSync(DEVELOPER_EDITION) ? DEVELOPER_EDITION : null;

export default {
  sourceDir: "dist",
  artifactsDir: "web-ext-artifacts",
  ...(developerEdition && { run: { firefox: developerEdition } }),
};
