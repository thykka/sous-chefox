import { loadSettings, saveSettings } from "./settings";

for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
  el.textContent = browser.i18n.getMessage(el.dataset.i18n!);
}

const metric = document.querySelector<HTMLInputElement>("#metric")!;
const kitchen = document.querySelector<HTMLInputElement>("#kitchen")!;
const decimals = document.querySelector<HTMLInputElement>("#decimals")!;
const site = document.querySelector<HTMLInputElement>("#site")!;
const hostname = document.querySelector<HTMLElement>("#hostname")!;

async function main() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ? new URL(tab.url) : null;
  // Only web pages have a site to disable.
  const host = url && (url.protocol === "http:" || url.protocol === "https:") ? url.hostname : null;

  const settings = await loadSettings();
  metric.checked = settings.metric;
  kitchen.checked = settings.kitchen;
  decimals.checked = settings.decimals;
  site.checked = host !== null && settings.disabledSites.includes(host);
  site.disabled = host === null;
  hostname.textContent = host ?? "";

  metric.addEventListener("change", () => void saveSettings({ metric: metric.checked }));
  kitchen.addEventListener("change", () => void saveSettings({ kitchen: kitchen.checked }));
  decimals.addEventListener("change", () => void saveSettings({ decimals: decimals.checked }));
  site.addEventListener("change", async () => {
    const { disabledSites } = await loadSettings();
    const others = disabledSites.filter((s) => s !== host);
    await saveSettings({ disabledSites: site.checked ? [...others, host!] : others });
  });
}

void main();
