# sous-chefox

A Firefox extension for unit conversions and calculations in recipes.

## Installation

Download and install the extension from https://addons.mozilla.org/en-US/firefox/addon/sous-chefox/

## Development

Needs Node 22.23.4 or later (see `.nvmrc`).

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

Test fixtures in `test/fixtures/` are synthetic pages: each copies the markup of a real recipe site (its tags, nesting and class names, and quirks like a hidden print copy or amounts in separate cells) around a recipe and text written for the tests. Real pages are other people's work and never go into the repository.

```sh
npm run capture -- <url> <name>                     # fetch and trim a page into .scratch/pages/<name>.html (git ignores it)
npm run dump -- .scratch/pages/<name>.html --outline   # the structure a synthetic fixture needs to copy
npm run dump -- <fixture name or path>              # what attach does to it: list, lines, steps, 2x
                                                    # (dl/rkl/tl and decimals; --ml, --fractions, --imperial)
```

Many recipe sites refuse scripted requests: save the page from Firefox and pass it with `--from page.html`. Write the fixture by hand from the outline, with a header comment naming the site it's shaped after. The dump is a draft: work out each expectation from the recipe before putting it in a test.

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

## Support

Report bugs and ask questions on the [issue tracker](https://github.com/thykka/sous-chefox/issues).

## License

Sous-Chefox is free software, licensed under the GNU General Public License, version 3 or (at your option) any later version. See [LICENSE](LICENSE).
