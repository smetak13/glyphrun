# Roadmap

Everything agreed but kept out of the MVP (`docs/SPEC.md`). Roughly in priority order within each group.

## Sound

Music and sound effects moved into the MVP (`docs/IMPLEMENTATION.md`, task 10). Later:

- More tracks when task 11 adds levels beyond ten, so a run never repeats a level track.
- A track per future boss (see Content).

## Modes

- **Practice**: one level with a chosen difficulty and seed.
- **Online board for the daily seed** (the offline daily is in the MVP, SPEC 9.1): one board per day and game version; the client submits at the end of a daily run and shows today's top entries and the player's place. Opt-in in Settings with a clear note of what is sent (nickname, seed, score, time, per-level breakdown); minimal stored data, no IPs kept. Anonymous nickname with a locally stored token, a name filter and manual removal of entries. Host to choose (a serverless Worker with a database, or similar).
  - **Anti-cheat by limits**: the client cannot be trusted with a secret (the game is open source, so hashing or signing the score stops nobody). Instead the server generates the day's levels once and rejects impossible submissions: more bits or kill points than the levels hold, a time faster than running flat-out through their width, a per-level breakdown (bits, kills, sudo, time) that does not add up to the score or fit the levels, more than one entry per nickname per day, and rate limits. Plausible invented scores still pass; obvious fakes are removed by hand.
  - **Versioning**: a change to physics, chunks or the generator changes what a seed produces, so every submission carries a ruleset version and boards are kept per version.
  - **Later, only if cheating becomes a problem: replays.** The client records the per-step inputs (only their changes, a few KB per run) and the server replays them through the same `logic/*.mjs` modules. This needs the logic to be bit-identical in Qt's JavaScript engine and V8: `Math.sin` and `Math.cos` (spinlock arm, zombie bob) replaced by our own version, and a test that a run recorded in the game replays exactly in Node. Replays are also useful offline (watch your best run, race a ghost).
- **Campaign**: hand-designed levels built on the same design principles as the generator (introduce, test, twist, combine).

## Levels and sharing

1. **Level editor**, writing the same text level format the generator uses.
2. **Sharing by code**: a level encoded as a short string to paste into the game. The level format is versioned, compact and validated from the start for this reason.
3. **Shared library on GitHub**: levels as files or issues, votes as 👍 reactions, sorting by popularity, sign-in with GitHub device flow against vote abuse. Uploads must be completed by their author and pass the validator. Moderation: levels can be taken down (closing the issue or deleting the file). Ranking later beyond raw votes (vote ratio, completions, a "new" section).
4. **Own backend** only for a large community: search, tags, leaderboards, difficulty measured from completions.

## Content

- More bosses chosen by the seed:
  - **rm -rf /**: a chase. It advances from the left, deleting the level column by column into `/dev/null`; reach `^C` at the end.
  - **OOM Killer**: an arena boss that hunts the biggest process, more aggressive while the hero is big (`@@`).
- More enemies and traps, especially advanced ones. Walking enemies that fall off ledges as an advanced trait.
- Dash as a power-up.
- Terrain beyond the existing tiles: moving platforms, crumbling platforms and springs.

## Controls and settings

- Key remapping.
- Gamepad support (not verified whether Qt in the Omarchy shell supports it).
- Persisting the run in progress across shell restarts.

## Publishing

- Plugin description and tags. Working wording: *Retro platformer made in ASCII, living in your Omarchy theme. Procedurally generated runs, 11 enemies, one final boss.*
- Discoverability without trademarks: no "Mario" in the name, description or tags. Use generic terms such as `platformer`, `retro-game`, `ascii-game`, `omarchy` as GitHub topics.
