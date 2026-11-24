# Roadmap

Everything agreed but kept out of the MVP (`docs/SPEC.md`). Roughly in priority order within each group.

## Sound

Music and sound effects moved into the MVP (`docs/IMPLEMENTATION.md`, task 10). Later:

- More tracks when task 11 adds levels beyond ten, so a run never repeats a level track.
- A track per future boss (see Content).

## Modes

- **Practice**: one level with a chosen difficulty and seed.
- **Daily seed**: everyone plays the same seed each day; a natural home for speedrun times.
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
