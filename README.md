# Flick — NCLEX-RN flashcard prototype

A demo of the **Flick** flashcard concept: a 50-card NCLEX-RN starter deck plus your own decks, with spaced-repetition scheduling, in one static page.

**Live target:** https://sashalosh.shop/flashcards/

## What's in it

- **Decks** — the built-in NCLEX-RN deck plus any number of your own. Create a deck, add cards one at a time or paste a list (`question | answer | explanation`, or tab-separated text from Quizlet/Anki), edit, delete, rename. New-card limits are per deck.
- **Today** — cards due today (split into review / learning / new, with a note on what "learning" means), one Start button, adjustable new cards per day, study by exam area, and a Flagged box with **Review flagged**
- **Study mode** — full screen; flip cards, multiple choice and select-all-that-apply; a "Why" rationale on every card; live new / learning / review counts; flag a card for review
  - **Two-step grading** (default, after Osmosis): pick confidence (Low / Medium / High) before the answer, then **Missed it** / **Got it**, each showing the next interval. Got it + Low/Medium/High maps to Hard/Good/Easy. The session summary counts confident misses.
  - **Four-button grading** (Again / Hard / Good / Easy) is still available in Settings.
  - Learning cards wait their full gap (1–10 min) before coming back; if only those are left, a "back in m:ss" screen offers wait, review early, or finish.
  - The hero also holds the new-cards stepper (beside the due count) and an **activity heatmap**: one calendar month of cards studied per day, darker for more, with arrows for one month back or forward. History starts when this version is first used.
  - A **Merch** button opens a demo store (`#merch`): four placeholder products, a cart and a pretend checkout. No payment is taken. The product photos and prices are placeholders to replace before launch.
- **Cards** — search and filter by exam area or flagged; flag/unflag, edit and delete your own cards. **Edit description** changes the deck's description (shown on Today and Cards) and the instructions line (Cards); both fall back to defaults when cleared. Your own cards can carry an optional **Source** (text or a link), shown with the answer.
- **Progress** — readiness by exam area and a 7-day review forecast
- **Demo clock** (Settings) — jump ahead a day to show reviews coming back

Keyboard: two-step mode `1`–`3` confidence, then `1` Missed / `2` Got it · four-button mode `Space` reveal, `1`–`4` grade · `A`–`E` pick an option · `F` flag · `Esc` exit.

## How it's built

- `index.html` only: HTML, CSS and vanilla JavaScript, no build step or dependencies (Inter font from Google Fonts).
- Progress and user decks are stored in the visitor's browser (`localStorage`, key `flick-nclex-v1`, state version 2; version 1 progress migrates automatically). No accounts, no backend, so decks don't sync across devices yet.
- Inside the script, three parts are kept separate to ease a later move to React: **data** (`TOPICS`, `CARDS`), **scheduler** (`plan()`, a simple SM-2-style algorithm with learning steps), and **views**.

## Deploy

Upload `index.html` to a `flashcards/` folder on the site. With S3 + CloudFront:

```bash
aws s3 cp index.html s3://<bucket>/flashcards/index.html --content-type text/html --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id <id> --paths "/flashcards/*"
```

All paths are relative, so it also works at a subdomain root.

## Content note

The cards were written for this prototype, not taken from a test bank. Have a nurse educator review them before showing them to students. Not clinical guidance.

## Next steps

- React front end
- Accounts and server-side progress (Supabase or a Python/Java API on Postgres)
- Anki (.apkg) import and export
- Sync decks and progress across devices
