# AMO listing

Copy for the addons.mozilla.org listing. Paste each section into the field it's named after.

One field is still to be decided before submitting: **Support** (an email address and/or the GitHub Issues page). It's marked TODO below.

## Summary

Converts recipe amounts to metric and scales them, right on the recipe page. Finnish kitchen units by default. Works on Firefox for desktop and Android. No data leaves your browser.

## Description

Sous-Chefox rewrites the ingredient list of the recipe you're reading. Cups, spoons, ounces and pounds become metric: by default in the units Finnish kitchens use (dl, rkl, tl), or in millilitres if you prefer. Butter and chocolate are weighed in grams. Oven temperatures become °C and pan sizes become centimetres. An amount the site already gives in metric is used as written, and recipes that are already metric, such as Finnish ones, are scaled in their own units.

Above the ingredient list, a small control scales the recipe: step the number of servings, type a multiplier, or press − and + to halve or double it. Every amount follows. Hover over (or tap) a converted amount to see what the recipe originally said.

From the toolbar popup you can:

- Choose between Finnish kitchen units (dl, rkl, tl) and millilitres.
- Show amounts as decimals (0,5) or fractions (½).
- Turn metric conversion off to scale the recipe in its own units.
- Turn automatic conversion off, and convert a page only when you press "Convert this page".
- Turn Sous-Chefox off for a site.

On desktop, you can also select ingredient lines on any page and choose "Convert with Sous-Chefox" from the context menu.

A line Sous-Chefox can't fully read is left exactly as written, and a page where it can't find the ingredient list confidently isn't changed at all.

## Why Sous-Chefox needs access to all websites

Recipes are published on thousands of sites, so Sous-Chefox can't know in advance which pages hold one. When a page loads, it checks locally for the structured recipe data that recipe sites publish (schema.org Recipe). If there is none, it stops there and leaves the page alone; the check takes well under a millisecond. On recipe pages it looks for the ingredient list once, and if the page is still loading or redraws itself, it tries again a few more times for a few seconds before stopping.

If you'd rather it didn't look at pages on its own, turn off "Convert recipe pages automatically" in the popup. It then does nothing until you press "Convert this page" or use the context menu. Everything runs in your browser.

## Privacy

Sous-Chefox collects no data and makes no network requests. Your settings are kept in Firefox's extension storage on your device: whether to convert automatically, metric on or off, kitchen units or millilitres, decimals or fractions, and the sites you've turned it off for. Nothing you read, select or convert leaves your browser.

## Permissions

- **Access your data for all websites**: to check each page for a recipe and convert it in place (see above).
- **Store data in extension storage** (`storage`): to remember your settings.
- **Context menus** (`menus`): for the "Convert with Sous-Chefox" entry on selected text. Firefox for Android has no context menus, so the entry isn't there.

## Support

TODO: support email and/or website (for example the repository's GitHub Issues page).

## License

GNU General Public License v3.0 or later (GPL-3.0-or-later).

## Notes to reviewer

The extension is written in TypeScript and bundled with Vite, without minification. To build it from the submitted source with Node 22.23.4 or later (see `.nvmrc`):

```sh
npm ci
npm run build    # writes the extension to dist/
```

The tests (`npm test`) use synthetic pages in `test/fixtures/`, shaped like real recipe sites but with invented recipes. They aren't part of the built extension.
