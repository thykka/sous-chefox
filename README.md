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
