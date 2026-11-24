# Pakia Pakia! | Agent guide

Daily grocery-bagging logic puzzle on Devvit Web, built for the Reddit Game of the Day Hackathon 2026 (Best Daily Game). Deadline: Dec 8, 2026, 6:00 PM PT. Judging: Dec 9 to 16, 2026. The judging criteria carry equal weight; their order only breaks ties.

## Hard rules

- Everything in the repo is in English: code, comments, UI, docs, commits.
- No emoji, no all-caps styling (`uppercase`, spaced small caps), no em or en dashes, no gradients or glow.
- Icons: Hugeicons free stroke-rounded set only, always through `src/client/icons.ts` (`<Icon>` / `<TagIcon>` in `components/Art.tsx`, `iconMarkup` for vanilla code).
- Fonts are bundled in `src/client/fonts`: Fredoka (interface), Patrick Hand (handwritten exclamations such as the stamp), JetBrains Mono (receipt paper, and digits everywhere through the `Digits` face).
- No external network calls from client or server.
- Do not publish to App Review. Upload and playtest only, in a public test subreddit with fewer than 200 members.
- A root `README.md` is mandatory and must stay accurate.
- Never commit, push or upload without the owner's go-ahead. No assistant attribution in commits.
- At least 15 verified puzzles must cover the judging window; `npm test` enforces it.

## Layout

- `src/shared`: types, item catalog, validator, solver, dates (UTC day keys, launch day 2026-11-20 is #1), house puzzles (generated), receipt checks, guards, API types.
- `src/server`: Hono app. `routes/api.ts` (game, splash, solve, share, subscribe, vote, receipts), `core/daily.ts` (pick the day's puzzle, create the post), `redis.ts` (all keys), menus, forms, triggers, scheduler.
- `src/client`: `splash.html` + `splash.ts` (inline feed card, vanilla), `game.html` + `game.tsx` + `App.tsx` (React game), `components/`, `hooks/useGame.ts`, `art/items.ts` (item SVGs), `rules.ts`, `utils/`.
- `tools/local`: mocks for `@devvit/web/client` and `/server`, plus the local API with `/__dev/*` helpers. Used only by `npm run dev:local`.
- `scripts/generate-puzzles.ts`: regenerates `src/shared/puzzles.ts`. Never edit that file by hand.

## Commands

- `npm run dev:local`: local playground at http://localhost:5173 with a Dev menu.
- `npm run dev`: `devvit playtest` on the test subreddit.
- `npm run type-check`, `npm run lint`, `npm test`, `npm run build`.
- `npm run deploy`: checks, then `devvit upload`.

## Game rules (single source: `src/shared/validator.ts`)

- Heavy: the item's bottom row is the bag's bottom row.
- Fragile: no other item anywhere above it in the same columns.
- Temperature: cold and hot items cannot touch orthogonally.
- Upright: the item cannot be rotated.
- Difficulty by solution count: hard up to 250, medium up to 4 000, easy above.

## Customer of the Day

Players who solved can vote for one pending community receipt per day (vote can be changed) and submit one receipt per day. At 00:00 UTC the most voted receipt with at least one vote becomes the next daily puzzle, credited to its author; otherwise the house receipt for that day is used.

## Status and next steps

- Done: game, rules engine, solver, 101 verified house receipts, Customer of the Day loop, splash card, local playground, README. Local flow tested end to end (solve, conflicts, vote, write a receipt, share, election).
- Name: the game was first called "Bagged!" and is now "Pakia Pakia!" (Swahili for "pack, pack!"). The local folder may still be named `Bagged`.
- Next: playtest on Reddit (`npm run login`, then `npm run dev` on the test subreddit, then the moderator menu "Pakia Pakia!: post today's bag"), check the splash card and the game in the real Reddit apps (desktop, iOS, Android), fix what shows up, then `npm run deploy`.
- Before the deadline: public GitHub repo `PakiaPakia`, a demo video, and the Devpost submission.
- Known local-only gap: after the Dev menu's election, the splash card still shows the house receipt; on Reddit the post is created after the election, so both match.
