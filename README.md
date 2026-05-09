# interview-prep-drill

Personal interview-prep drill — an OpenClaw subagent that owns a single
`#drill` Discord channel, picks the next due card via SM-2, asks it, and
grades the answer.

Decks:

- **Blind 75** — algorithm problems, body bodies under `problems/`.
- **Sysdesign flashcards** — ~30 system-design prompts under `flashcards/`.

The single `#drill` channel mixes both; the scheduler picks whatever is due
next. Day 1 ships only the foundations: SM-2 algorithm, persistence, and
tests. The agent runtime, seed scripts, and channel UX land in later days.

## Layout

```
lib/
  sm2.ts        canonical SM-2 (pure function)
  db.ts         better-sqlite3 singleton + schema
tests/
  sm2.test.ts   SM-2 paths & edge cases
  db.test.ts    schema, ingest idempotency, state writes
scripts/
  smoke.ts      end-to-end smoke: open db, insert card, review q=4
```

## Persistence

SQLite at `~/.openclaw/interview-prep-drill/cards.db` (WAL mode), with three
tables:

- `cards`        — id, deck, source_path, title, body_md, created_at
- `card_state`   — per-card SM-2 state (ef, interval, reps, due_at, last_reviewed_at)
- `reviews`      — append-only log of every grade (quality, response_md, grade_notes)

Card bodies live in user-editable markdown under `problems/` and `flashcards/`
(seeded in Day 2). Body text is also mirrored into `cards.body_md` so the
agent never has to read the disk during a drill.

## SM-2

Implemented in `lib/sm2.ts` as a pure function:

```ts
review(state, quality /* 0..5 */, now?) -> CardState
```

- EF init `2.5`, floor `1.3`.
- `q < 3` resets `reps` to 0 and `interval` to 1 day, but EF still drags down
  via the standard update formula.
- `q >= 3`: `reps == 0` → 1 day, `reps == 1` → 6 days, otherwise
  `round(prevInterval * EF')`.

## Run

```sh
# from ~/stebot/interview-prep-drill
pnpm install                # picks up onlyBuiltDependencies for better-sqlite3
pnpm test                   # vitest
pnpm exec tsc --noEmit      # typecheck
pnpm exec tsx scripts/smoke.ts
```

> **Workspace note:** `better-sqlite3` is a native module. `pnpm` will refuse
> to build it unless the workspace root `package.json` lists it under
> `pnpm.onlyBuiltDependencies`. The root at `/Users/stevenchen/stebot/` already
> has the entry.
