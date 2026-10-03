# Writing Assistant

Rules-only writing checker for call-centre work email. Ships as one offline HTML file: `dist/writing-assistant.html`.

## Hard rules
- **No AI and no network.** The owner's workplace does not allow AI tools. Never add API calls, fetches, CDN scripts, web fonts or analytics. `src/index.html` has a CSP of `default-src 'none'`; keep it.
- **One file.** Everything (code, styles, dictionary) is inlined by `build.mjs`. Do not split the output.
- **Light mode only, Apple style.** System font stack, `#f5f5f7` background, `#007aff` accent, segmented controls, grouped inset lists, sheets. No dark mode.
- **NZ English** in all interface text and defaults.
- Keep `src/engine.js` free of DOM and storage code so `npm test` can cover it.

## Commands
- `npm test`: engine tests (Node's built-in runner).
- `npm run build`: writes `dist/writing-assistant.html`. Commit the built file; it is what gets opened at work.
- `npm run e2e`: opens the built file in Chromium with Playwright and clicks through every feature. Fails on any network request or console error. Screenshots go to `screenshots/` (git-ignored).
- `npm run check`: all three.

## Where things are
- `src/rules.js`: word lists, samples, example templates, label groups. Most content changes happen here.
- `src/engine.js`: clean-up, rules, spelling, checklists, scores, personal-detail redaction, template search and merge.
- `src/app.js`: interface. State lives in `state`; browser storage keys are prefixed `wa.v1.`.
- `ROADMAP.md`: every feature with how to test it. Tick items there as they are demoed. Phase 2 is planned work; the ASD-STE100 profile is parked.
- ASD-STE100: the specification and its dictionary belong to ASD. Never commit the dictionary or copy large parts of the spec into this repo. The app imports the approved-word list from the owner's own copy at run time.

## Demoing
Open the built file, pick a sample from **Try a sample**, and follow `ROADMAP.md` section by section.
