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

The extension is built into `dist/`. Test fixtures in `test/fixtures/` are trimmed snapshots of real recipe pages.

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
