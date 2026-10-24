# Coding standards

Rules for reviewing a change. Type errors, test failures and manifest problems are left to `npm run typecheck`, `npm test` and `npm run lint` (all three run in CI).

## Tests

- **Behaviour only.** A test checks what an action leaves on the page (text, markup, tooltips, the scaling control in its shadow root) or what a line becomes. It never checks internal data shapes, which helper ran, or intermediate parse results, so refactoring the internals breaks nothing.
- **Two seams.** Page behaviour is tested through `attach` / `attachWhenReady` / `attachToSelection` and the returned controller, in jsdom (`test/attach.test.ts`); line rules through `rewriteLine`, table-driven (`test/rewriteLine.test.ts`). A new test goes at one of these seams.
- **Independent expectations.** Expected values are literals worked out from the spec or a real page: "180 g", "1½ cups". An expectation computed the way the code computes it passes by construction.
- **Spec wording.** A test name states the behaviour the issue asks for, in the issue's words. A name that describes what the code happens to do ("above the selected list" when the issue says "above the selection") hides a mismatch with the spec.
- **Site-shaped fixtures.** A site that breaks becomes a synthetic fixture in `test/fixtures/`: its markup copied from a page captured with `npm run capture` (see the README), its recipe and text invented. A captured page stays in `.scratch/`, never in the repository.

## Page rewriting

- **Exact revert.** Every change to the page can be undone so that `outerHTML` matches the original byte for byte, and re-rendering always starts from the stored originals, never from rewritten text.
- **Convert once.** Every path that rewrites text (automatic, manual selection, re-attaching after a settings change) leaves alone text that a live controller already owns.
- **Leave it as written.** A line that can't be fully read stays exactly as it is. A line is never half-converted.
- **Touch only the recipe.** Text outside the located ingredient list, instruction steps or selection stays untouched.

## Structure

- **Pure core.** `src/core` never uses `browser.*` or any other extension API, so it runs unchanged in jsdom. Storage, menus, messaging and i18n lookups belong in the wrapper (`src/content.ts`, `src/popup.ts`, `src/background.ts`, `src/settings.ts`).
- **Interface text through `browser.i18n`.** Text a user sees is a key in `public/_locales/en/messages.json`. The core takes it as a `Messages` value and keeps `ENGLISH` as the test default.
- **Comments match the surrounding code.** One-line JSDoc that states the behaviour, with examples quoted as they appear on a page ("2 (14 oz) cans"). A comment explains a reason or a gotcha, never what the next line does.
