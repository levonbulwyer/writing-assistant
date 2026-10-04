# Writing Assistant

Rules-only writing checker for call-centre work email. Ships as one offline HTML file: `dist/writing-assistant.html`.

## Hard rules
- **No AI and no network.** The owner's workplace does not allow AI tools. Never add API calls, fetches, CDN scripts, web fonts or analytics. `src/index.html` has a CSP of `default-src 'none'`. Two exceptions are allowed so Harper's WebAssembly can start from inside the file: `'wasm-unsafe-eval'` in `script-src` and `connect-src blob:`. Do not widen it further.
- **One file.** Everything (code, styles, dictionary) is inlined by `build.mjs`. Do not split the output.
- **Light mode only, Apple style.** System font stack, `#f5f5f7` background, `#007aff` accent, segmented controls, grouped inset lists, sheets. No dark mode.
- **NZ English** in all interface text and defaults.
- Libraries (retext, compromise, Harper) live in `src/extras.js`, never in `engine.js`. They return plain issues that `check()` merges via its `extra` option.
- Keep `src/engine.js` free of DOM and storage code so `npm test` can cover it.

## Commands
- `npm test`: engine tests (Node's built-in runner).
- `npm run build`: writes `dist/writing-assistant.html`. Commit the built file; it is what gets opened at work. Also copy it to `docs/index.html`: GitHub Pages serves that folder at https://levonbulwyer.github.io/writing-assistant/. The file is about 12 MB, so release it in batches rather than for every small change. Node is not on the PATH on the owner's Mac; a copy lives in `~/.local/node-v22.23.3-darwin-arm64/bin`.
- `npm run e2e`: opens the built file in Chromium with Playwright and clicks through every feature. Fails on any network request or console error. Screenshots go to `screenshots/` (git-ignored).
- `npm run check`: all three.

## Where things are
- `src/rules.js`: word lists, samples, example templates, label groups. Most content changes happen here.
- `src/engine.js`: clean-up, rules, spelling, checklists, scores, personal-detail redaction, template search and merge.
- `src/extras.js`: grammar libraries. Harper loads after start-up from a gzipped base64 copy of its WebAssembly in the page, and lints about half a second after you stop typing.
- `src/app.js`: interface. State lives in `state`; browser storage keys are prefixed `wa.v1.`.
- `ROADMAP.md`: every feature with how to test it. Tick items there as they are demoed. Phase 2 is planned work; the ASD-STE100 profile is parked.
- ASD-STE100: the specification and its dictionary belong to ASD. Never commit the dictionary or copy large parts of the spec into this repo. The app imports the approved-word list from the owner's own copy at run time.

## Demoing
Open the built file, pick a sample from **Try a sample**, and follow `ROADMAP.md` section by section.
