/** Sent from the context menu to the tab's content script: convert the selected text. */
export const CONVERT_SELECTION = "convertSelection";

/**
 * Sent from the popup to the tab's content script: find and convert the page's recipe now.
 * The answer says whether there is one: `{ found: boolean }`.
 */
export const CONVERT_PAGE = "convertPage";
