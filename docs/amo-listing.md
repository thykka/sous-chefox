# AMO listing

Copy for the addons.mozilla.org listing. Paste each section into the field it's named after.

## Summary

Converts recipe amounts to metric and scales them, right on the recipe page. Works on Firefox for desktop and Android. No data leaves your browser.

## Description

Sous-Chefox rewrites the ingredient list of the recipe you're reading: cups, spoons, ounces and pounds become grams and millilitres, oven temperatures become °C and pan sizes become centimetres. Dry ingredients such as flour and sugar are weighed rather than measured by volume, and an amount the site already gives in metric is used as written.

Above the ingredient list, a small control scales the recipe: type a multiplier or step the number of servings, and every amount follows. Hover over (or tap) a converted amount to see what the recipe originally said.

- Turn metric conversion off to scale the recipe in its own units.
- Turn Sous-Chefox off for a site from the toolbar popup.
- On desktop, select ingredient lines on any page and choose "Convert with Sous-Chefox" from the context menu.

A line Sous-Chefox can't fully read is left exactly as written, and a page where it can't find the ingredient list confidently isn't changed at all.

## Why Sous-Chefox needs access to all websites

Recipes are published on thousands of sites, so Sous-Chefox can't know in advance which pages hold one. On every page it loads, it checks locally for the structured recipe data that recipe sites publish (schema.org Recipe). If there is none, it exits immediately and changes nothing. The check runs entirely in your browser.

## Privacy

Sous-Chefox collects no data and makes no network requests. Your settings (metric on or off, sites you've turned it off for) are kept in Firefox's extension storage on your device. Nothing you read, select or convert leaves your browser.

## Permissions

- **Access your data for all websites**: to check each page for a recipe and convert it in place (see above).
- **Store data in extension storage** (`storage`): to remember your settings.
- **Context menus** (`menus`): for the "Convert with Sous-Chefox" entry on selected text. Firefox for Android has no context menus, so the entry isn't there.

## Notes to reviewer

The extension is written in TypeScript and bundled with Vite, without minification. To build it from the submitted source with Node 22:

```sh
npm ci
npm run build    # writes the extension to dist/
```
