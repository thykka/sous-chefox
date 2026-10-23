# sous-chefox

A Firefox extension for unit conversions and calculations in recipes.

## Development

Needs Node 22 (see `.nvmrc`).

```sh
npm install
npm test           # Vitest (jsdom)
npm run typecheck
npm start          # build, then launch Firefox with the extension via web-ext
npm run lint       # build, then web-ext lint
```

The extension is built into `dist/`.

The manifest needs Firefox 140 or later. `npm start` uses Firefox Developer Edition when it's installed in the default location, and release Firefox otherwise. To pick a different one, run `WEB_EXT_FIREFOX=<path or name> npm start`.

## Fixtures

Test fixtures in `test/fixtures/` are trimmed snapshots of real recipe pages.

```sh
npm run fixture -- <url> <name>    # fetch and trim a page into test/fixtures/<name>.html
npm run dump -- <name>             # what attach does to it: list, lines, steps, 2x
```

Many recipe sites refuse scripted requests: save the page from Firefox and pass it with `--from page.html`. A fixture over 100 KB can be cut down further with `--drop <selector>` or `--cut <selector>:<n>`. The dump is a draft: work out each expectation from the recipe before putting it in a test.

## Release

```sh
npm run release    # build, web-ext lint, then zip dist/ into web-ext-artifacts/
```

Upload the zip from `web-ext-artifacts/` to addons.mozilla.org, with a source archive of the repository (the bundle is built from TypeScript). The listing copy is in `docs/amo-listing.md`.

## Firefox for Android

The extension runs on Firefox for Android 142 and later. To try a build on a phone connected over USB, with USB debugging on and remote debugging enabled in Firefox's settings:

```sh
npm run build
npx web-ext run -t firefox-android --adb-device <device id> --firefox-apk org.mozilla.fenix
```

`adb devices` lists the device id. Check that a recipe page is converted on load, that the scaling control works by touch, and that the popup (which opens as a full-screen page) changes the settings. There is no context-menu entry on Android.
