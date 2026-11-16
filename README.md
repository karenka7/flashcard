# Flick — NCLEX-RN flashcard prototype

A demo of the **Flick** flashcard concept: a 50-card NCLEX-RN deck with spaced-repetition scheduling, in one static page.

**Live target:** https://sashalosh.shop/flashcards/

## What's in it

- **Today** — cards due today, one Start button, adjustable new cards per day, study by exam area
- **Study mode** — full screen; flip cards, multiple choice and select-all-that-apply; a "Why" rationale on every card; grade buttons show the next interval (Again / Hard / Good / Easy); flag a card for review
- **Cards** — search and filter the deck by exam area or flagged
- **Progress** — readiness by exam area and a 7-day review forecast
- **Demo clock** (Settings) — jump ahead a day to show reviews coming back

Keyboard: `Space` reveal · `1`–`4` grade · `A`–`E` pick an option · `F` flag · `Esc` exit.

## How it's built

- `index.html` only: HTML, CSS and vanilla JavaScript, no build step or dependencies (Inter font from Google Fonts).
- Progress is stored in the visitor's browser (`localStorage`, key `flick-nclex-v1`). No accounts, no backend.
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
- Card authoring and import
