import type { Settings } from "./core/attach";

/**
 * What `storage.local` holds. The scale and manual conversions are never saved.
 * Finnish kitchen units and decimals are the defaults.
 */
export type StoredSettings = { metric: boolean; kitchen: boolean; decimals: boolean; disabledSites: string[] };

const DEFAULTS: StoredSettings = { metric: true, kitchen: true, decimals: true, disabledSites: [] };

export async function loadSettings(): Promise<StoredSettings> {
  const stored = await browser.storage.local.get(DEFAULTS);
  return {
    metric: stored.metric !== false,
    kitchen: stored.kitchen !== false,
    decimals: stored.decimals !== false,
    disabledSites: Array.isArray(stored.disabledSites) ? stored.disabledSites.filter((s) => typeof s === "string") : [],
  };
}

export function saveSettings(settings: Partial<StoredSettings>): Promise<void> {
  return browser.storage.local.set(settings);
}

/** Calls `listener` with the new settings whenever they change, from any page. */
export function onSettingsChanged(listener: (settings: StoredSettings) => void): void {
  browser.storage.onChanged.addListener((_changes, area) => {
    if (area === "local") void loadSettings().then(listener);
  });
}

/** The settings for a page on `hostname`. */
export function siteSettings(stored: StoredSettings, hostname: string): Settings {
  return {
    metric: stored.metric,
    kitchen: stored.kitchen,
    decimals: stored.decimals,
    siteDisabled: stored.disabledSites.includes(hostname),
  };
}
