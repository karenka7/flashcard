# Flick — NCLEX-RN flashcard prototype

A demo of the **Flick** flashcard concept: a 50-card NCLEX-RN starter deck plus your own decks, with spaced-repetition scheduling. A static site built with Vite.

**Live target:** https://sashalosh.shop/flashcards/

## What's in it

- **Decks** — the built-in NCLEX-RN deck, a 36-card **Anatomy & Physiology** demo deck (30 text cards plus six with simplified diagrams: three with the image on the front, three on the back), a 23-card **Music Notes** demo deck (13 single notes: a treble-clef note on the front, the letter and the note's sound on the back, middle C to A5; plus 10 two-note chords: hear the chord and see it on the staff, then name both notes, with the interval in the explanation; the staff is drawn in SVG and the tones are generated in the browser, so there are no image or audio files), plus any number of your own. Your own cards can have an **image on the front, the back or both** (Upload image in the card form); uploads are shrunk to 1000px JPEGs and stored in the browser with the deck, so storage space is limited. Cards can also have a **sound on the front, the back or both**: upload an audio file (up to 3 MB) or **Record** from the microphone (up to 60 s). Sounds are kept in the browser's IndexedDB, not localStorage, and the card stores only a key. **+ Add cards** works on every deck: cards added to a built-in deck are saved as your own (in `extra` in the saved state), can be edited and deleted, and survive Reset progress; the built-in cards themselves stay read-only. Create a deck, add cards one at a time or paste a list (`question | answer | explanation`, or tab-separated text from Quizlet/Anki), edit, delete, rename. New-card limits are per deck.
- **Today** — cards due today (split into review / learning / new, with a note on what "learning" means), one Start button, adjustable new cards per day, a per-deck **Shuffle cards** switch (random new-card picks and review order; also in Settings), study by exam area, and a Flagged box with **Review flagged**
- **Study mode** — full screen; cards sit in a card frame and **flip over** when the answer is shown (a short 3D turn, skipped when the system asks for reduced motion). The back shows only the answer side (answer, explanation, source, back image/sound; multiple-choice options stay, marked right/wrong); **Show front** brings the question back; flip cards, multiple choice and select-all-that-apply; a "Why" rationale on every card; live new / learning / review counts; flag a card for review
  - **Two-step grading** (default, after Osmosis): pick confidence (Low / Medium / High) before the answer, then **Missed it** / **Got it**, each showing the next interval. Got it + Low/Medium/High maps to Hard/Good/Easy. The session summary counts confident misses.
  - The confidence step can be turned off in Settings (“Ask how sure I am before showing the answer”): then it's Show answer, then Missed it / Got it, and Got it counts as Good.
  - **Four-button grading** (Again / Hard / Good / Easy) is still available in Settings.
  - Learning cards wait their full gap (1–10 min) before coming back; if only those are left, a "back in m:ss" screen offers wait, review early, or finish.
  - The hero also holds the new-cards stepper (beside the due count) and an **activity heatmap**: one calendar month of cards studied per day, darker for more, with arrows for one month back or forward. History starts when this version is first used.
- **Merch** — a fourth tab with a demo store (`#merch`): four placeholder products, a cart and a pretend checkout. No payment is taken. The product photos and prices are placeholders to replace before launch.
- **Cards** — search and filter by exam area or flagged; flag/unflag, edit and delete your own cards. **Edit description** changes the deck's description (shown on Today and Cards) and the instructions line (Cards); both fall back to defaults when cleared. Your own cards can carry an optional **Source** (text or a link), shown with the answer.
- **Make cards with AI** (Cards page) — upload a PDF, Word (.docx), text file or an image of a slide, or paste text such as a YouTube transcript; Claude suggests cards (front, back, explanation, and a source with page or timestamp when it can tell). You review, edit or untick each card, then add them to any deck or a new one. v1 is *bring your own key*: paste an Anthropic API key in Settings; it's stored in this browser only (`localStorage` key `flick-ai`) and the page calls the API directly, so don't use it on shared computers. All API code is in `aiMakeCards()`, so moving to a backend (Lambda or Supabase Edge Function holding the key, plus audio transcription) only changes that function.
- **Progress** — readiness by exam area and a 7-day review forecast
- **Demo clock** (Settings) — jump ahead a day to show reviews coming back

Keyboard: two-step mode `1`–`3` confidence, then `1` Missed / `2` Got it · four-button mode `Space` reveal, `1`–`4` grade · `A`–`E` pick an option · `F` flag · `P` play/pause the card's sound · `Esc` exit.

## How it's built

A [Vite](https://vite.dev) project: plain HTML, CSS and JavaScript split into ES modules, no framework yet (Inter font from Google Fonts). The favicon (the Flick logo) is embedded in `index.html` as SVG, with PNG fallbacks.

```
index.html            page shell (header, tabs, study and modal containers)
src/main.js           start-up: routing and loading sounds
src/styles.css
src/data/             built-in decks: nclex.js, anatomy.js, music.js (+ svg.js helper)
src/scheduler.js      plan(): SM-2-style scheduling with learning steps; fmt()
src/state.js          saved state (S), load/save, decks, due counts: the layer that moves to Supabase
src/media.js          card sounds in IndexedDB, generated note tones
src/ai.js             Make cards with AI: file reading and the API call (aiMakeCards)
src/dom.js, ui.js     shared helpers: $, esc, deck bar, modal, toast
src/router.js         route() and switchDeck()
src/views/            screens: today, cards, progress, study, merch
src/modals/           dialogs: decks, cardForm, settings, aiMaker
```

- Progress and user decks are stored in the visitor's browser (`localStorage`, key `flick-nclex-v1`, state version 2; version 1 progress migrates automatically). All reads and writes go through `src/state.js`, which is what changes when accounts arrive. No accounts or backend yet, so decks don't sync across devices.
- Card sounds are stored in IndexedDB (database `flick-media`, store `sounds`); in the real app they move to file storage (S3 or Supabase Storage).
- Screens still build HTML strings; they can move to React one at a time.

### Run locally

Needs Node 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173 with live reload
npm run build      # production files in dist/
npm run preview    # serve dist/ locally
```

## Deploy

Build, then upload the contents of `dist/` to the `flashcards/` folder. With S3 + CloudFront:

```bash
npm run build
aws s3 sync dist/assets s3://<bucket>/flashcards/assets --cache-control "public, max-age=31536000, immutable"
aws s3 cp dist/index.html s3://<bucket>/flashcards/index.html --content-type text/html --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id <id> --paths "/flashcards/*"
```

The files in `assets/` have a content hash in their names, so they can be cached for a long time; `index.html` is not cached, so a new build shows up straight away. Asset paths are relative (`base: "./"` in `vite.config.js`), so the build also works at a domain root.

## Content note

The cards were written for this prototype, not taken from a test bank. Have a nurse educator review them before showing them to students. Not clinical guidance.

## Next steps

- Move screens to React, one at a time
- Accounts and server-side progress (Supabase or a Python/Java API on Postgres)
- Anki (.apkg) import and export
- Sync decks and progress across devices
