# Roadmap and test guide

Phase 1 is built. Use its list to demo and test the app: each item says how to try it. `npm run e2e` runs most of these automatically. Phases 2 and 3 are the next work. Their tasks follow ASD-STE100 rules: one instruction for each sentence, and short sentences.

## Phase 1: Built

## 1. Scope and ground rules
- [x] Message types: **General**, **Email**, **Complaint reply** (segmented control at the top).
- [x] No network: `src/index.html` sets `default-src 'none'`. Test: open the built file, open DevTools → Network, use every feature. Only the file itself loads.
- [x] Five sample texts in `src/rules.js`: messy, wordy, complaint, blunt, already fine. Pick them from **Try a sample**.
- [x] One file: all word lists in `src/rules.js`, built into `dist/writing-assistant.html`.

## 2. Page shell
- [x] Two panes: draft on the left, issues on the right. Test: resize below 960px and they stack.
- [x] Live word count in the strip under the draft.
- [x] **Copy** button. Test: with a template blank left, the toast says how many blanks remain.
- [x] Opens straight from a folder (`file://`). Test: double-click the built file.

## 3. Auto-clean
- [x] Double spaces, trailing spaces, space before commas.
- [x] Rejoins lines broken by pasting. Test: sample **Messy paste** → **Clean**.
- [x] Quote style (Settings → Clean-up: curly, straight, leave).
- [x] Dash style (spaced en dash, em dash, leave) and bullet style (•, –, -).
- [x] Capitals after full stops, at line starts, the word I, days and months. Abbreviations like "e.g." are left alone.
- [x] **Undo**. Test: Clean, then Undo; the original comes back.

## 4. Rules engine (first usable version)
- [x] Sentence and word splitting that keeps character positions (`words`, `sentences` in `src/engine.js`).
- [x] Rules as plain data: phrase, swap, reason (`src/rules.js`).
- [x] Runner returns issues with start and end positions (`check`).
- [x] Highlight layer behind the text box. Test: underlines line up with words while typing and scrolling.
- [x] Click an issue to jump to it; click a word in the text to open its issue. **Apply fix** moves to the next issue.
- [x] **Ignore** (this wording) and **Turn Off Rule**. Both can be undone in Settings → Turned off and ignored.

## 5. Style rules
- [x] Filler words, wordy phrases with swaps, sentences over 25 words (adjustable), passive voice, repeated words, ALL CAPS and extra exclamation marks.
- [x] Your workplace phrase list. Test: Settings → Your phrase list → Add Phrase, then type it in the draft.
- [x] Every rule fires on its sample and none fires on **Already fine** (`npm test` checks this).

## 6. Spelling in NZ English
- [x] en-GB "-ise" Hunspell dictionary, bundled (about 550 KB).
- [x] Red wavy underline with up to three suggestions.
- [x] Personal dictionary. Test: **Add to Dictionary** on a name; manage it in Settings.
- [x] Skips email addresses, web addresses, numbers, acronyms, blanks, and capitalised names mid-sentence (switch in Settings).
- [x] Common te reo Māori words (kia ora, ngā mihi, whānau…) are known.

## 7. Message checklists
- [x] Complaint reply: greeting, acknowledgement, what was done, next step, deadline, sign-off.
- [x] Email: greeting, clear ask, deadline, sign-off.
- [x] Ticks update as you type. Test: sample **Complaint reply** shows 6/6; delete the sign-off and it drops to 5/6.

## 8. Scores
- [x] Words, sentences, average sentence length, characters, reading time.
- [x] Reading ease (Flesch) with a label; 60 or more is plain English.
- [x] Longest sentence: click it in the strip or Stats to select it.

## 9. Hardening
- [x] False alarms checked against all five samples (`npm test`).
- [x] 5,000-word paste checks in about a third of a second (`npm run e2e`).
- [x] All word lists in one file (`src/rules.js`).
- [x] Settings, dictionary, templates and draft saved in browser storage.
- [ ] Open it on the work computer and confirm it runs. **Needs you.**
- [x] Footer says it runs on this page only.

## 10. Template archiver
- [x] Storage: browser storage, with export and import as a backup file.
- [x] Labels: topic, situation and tone, plus **New** to add your own.
- [x] **Mark as Perfect** button in the toolbar.
- [x] Save sheet: title, message type, labels, and a "why it works" note.
- [x] Personal details become blanks: names (from the greeting, and everywhere else they appear), your name after the sign-off, phone numbers (NZ formats and 0800), email addresses, dollar amounts, dates, street addresses, reference numbers. Untick any to keep it.
- [x] Library: search, filter by message type or label.
- [x] **Use Template**: replace the draft or insert at the cursor; the first blank is selected and **Tab** / **Shift+Tab** move between blanks.
- [x] Edit, relabel and delete (delete asks to confirm).
- [x] Export and import the whole library.

## Phase 2: Improvement pipeline

Real false alarms and missed problems become tests. The tests then change the rules. Do this loop each fortnight.

```
Check pipeline:    Clean → Split → Classify → Rules → Score
Improvement loop:  Log → Test → Build → Release → Use at work ↻
```

### 11. Feedback log
- [ ] Add a Report button to each issue card. It keeps the sentence and the rule in a local log.
- [ ] Add a Missed problem button. Select the text, then type what the app did not find.
- [ ] Count the fixes, ignores and turn-offs for each rule. Keep the counts in this browser.
- [ ] Show a Rule health table in Settings. Sort the table by the ignore rate.
- [ ] Blank the personal details in each log item before you save it.
- [ ] Add an Export log button. Make the log one file.

### 12. Release routine
- [ ] Copy each log item into `test/engine.test.mjs` as a test case.
- [ ] Change the rule until the new test passes.
- [ ] Run `npm run check`. Do not release the file if a test fails.
- [ ] Show the version number and a short list of changes in Settings.
- [ ] Copy the new file to the work computer. Open it and test the five samples.
- [ ] Each fortnight, read the Rule health table. Change or remove rules with many ignores.

### 13. Check pipeline
- [ ] Divide the check into five stages: clean, split, classify, rules and score.
- [ ] Classify each sentence as an instruction or a description.
- [ ] Give each rule a profile tag: Plain English, Email, Complaint or STE100.
- [ ] Add a Profile setting. Make Plain English the default profile.
- [ ] Check only the paragraphs that changed. This keeps long texts fast.
- [ ] Write one test for each stage.

## Phase 3: ASD-STE100 profile

ASD-STE100 Issue 9 (2025) is a controlled language for technical text. Plain English stays the default profile. Use STE100 for customer instructions and process notes.

### 14. STE100 writing rules
- [ ] Get your copy of ASD-STE100 Issue 9 from asd-ste100.org. The copy is free.
- [ ] Set the sentence limit to 20 words for instructions and 25 words for descriptions.
- [ ] Flag paragraphs that have more than six sentences.
- [ ] Flag sentences with two instructions. Show one sentence for each instruction.
- [ ] Flag a condition that comes after its instruction. Show the condition first: "If …, do …".
- [ ] Flag the present perfect. Change "I have checked" to "I checked".
- [ ] Flag -ing verb forms and long verb groups, for example "should have been".
- [ ] Flag the passive voice in all instructions.
- [ ] Flag noun clusters of more than three words.
- [ ] Flag warnings that do not start with a simple command.

### 15. STE100 words
- [ ] Import the approved word list from your copy of the dictionary. Keep it in this browser.
- [ ] Do not put the ASD dictionary in this repo. ASD owns the copyright.
- [ ] Flag words that are not on the list. Show the approved word if the list has one.
- [ ] Add a Technical names list for products and parts, for example modem and router.
- [ ] Add a Technical verbs list for work actions, for example reset and escalate.
- [ ] Flag one thing with two names in one message. Use one name for one thing.

### 16. STE100 in the app
- [ ] Add an Instructions message type for customer steps.
- [ ] Make a checklist for Instructions: numbered steps, one action each, conditions first, warnings first.
- [ ] Show Instruction or Description on each issue card.
- [ ] Show an STE score: the percentage of sentences with no STE100 issue.
- [ ] Add two STE100 sample texts: a modem reset and a refund process.
- [ ] Add STE100 example templates to the library.

## Parked ideas
- [ ] Phrase bank of approved sentences to click and insert.
- [ ] Tone check from word lists (too blunt, too soft).
- [ ] Save templates as files in a chosen folder (File System Access API, Chrome and Edge only).
