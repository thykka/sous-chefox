import { CONVERT_SELECTION } from "./messages";

const MENU_ID = "convert-selection";

// Firefox for Android has no context menus, so manual conversion is desktop only.
if (browser.menus) {
  // Recreated whenever the background starts, so the entry is there exactly once.
  void browser.menus.removeAll().then(() =>
    browser.menus.create({
      id: MENU_ID,
      title: browser.i18n.getMessage("menuConvertSelection"),
      contexts: ["selection"],
    }),
  );
  browser.menus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
    void browser.tabs.sendMessage(tab.id, { type: CONVERT_SELECTION }, { frameId: info.frameId ?? 0 });
  });
}
