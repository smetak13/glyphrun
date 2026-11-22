# Glyphrun — Specification (MVP)

Glyphrun is a retro side-scrolling platformer made of ASCII, living in your Omarchy theme. It runs as an Omarchy shell (Quickshell) plugin in its own window, like Omatris. Every run is procedurally generated from a seed: five levels, ten kinds of enemies and traps, one final boss.

The hero is `@`, a programmer trying to ship perfect software. Bugs, zombie processes and worse stand in the way. The game is in English.

This document records every decision agreed during the design session. `docs/IMPLEMENTATION.md` breaks it into tasks; `ROADMAP.md` holds everything deferred. `docs/prototype/demo.html` is the visual target: open it in a browser.

## 1. Stack

| Concern | Choice |
|---|---|
| Host | Omarchy shell plugin (Quickshell, Qt 6.12). Kinds `bar-widget` and `panel`, like Omatris. |
| UI | QML. The game window is a Quickshell `FloatingWindow`: an ordinary application window, tiled or floating by the workspace's layout and Hyprland window rules, resizable. |
| Rendering | Qt Quick items: one `Text` item per glyph, positioned each frame from the logic state. Static parts (level, hexdump background) are cached with `layer.enabled`; glow and glitch use `MultiEffect`. No custom shaders. Chosen by the rendering spike, see `docs/spikes/rendering.md`. The game loop is a `FrameAnimation`. |
| Game logic | Pure JavaScript ES modules (`.mjs`) with no QML or Qt imports, imported by QML and by tests alike. Written in the JavaScript that Qt's QML engine supports, which is older than Node's: no object spread or rest, class fields, `??=`/`||=`, `Array.prototype.at`/`flat`/`flatMap`, `Object.fromEntries` and others (list in `docs/spikes/rendering.md`). |
| Tests | `node --test` (Node built-in runner). No npm dependencies. |
| Clipboard | `wl-copy`, run as a process, as other Omarchy plugins do. |
| Dependencies | None at runtime beyond the Omarchy shell. Installable with `omarchy plugin add <repo url>`. |
| License | MIT |

Plugin id: `smetak13.glyphrun`.

## 2. Domain

- **Run**: one attempt at five levels in a row, started from a seed. Holds lives, score, the sudo state and the drafted enemy set.
- **Seed**: 8 hex digits shown as `7f3a-91c2`. The seed alone determines every level layout, every enemy placement, the drafted enemy set and the boss's attack order. Two players on the same seed get the same game.
- **Level**: a horizontally scrolling stage about 60–90 seconds long for a decent player, one screen tall. Levels 1–5; level 5 ends in the boss arena.
- **Tile**: the 24 px grid cell. The logical screen is 40 × 22 tiles (960 × 540 px).
- **Chunk**: a hand-designed piece of level, a few to a dozen tiles wide, with tags (difficulty, which enemies it may hold, whether it is a safe introduction or a rest zone) and connection rules.
- **Bit**: a collectible `0` or `1`.
- **sudo**: the power-up. One bit per level secretly holds it.
- **Big / small**: the hero is small as `@` and big as `@@` (two stacked) while it holds sudo.
- **Basic / advanced**: enemy tiers (section 6).
- **Draft**: the enemies chosen for a run: 4 of the 5 basic and 3 of the 5 advanced.
- **Envelope**: the set of jumps the hero can physically make, computed from the physics constants. The generator never asks for more than a fraction of it.
- **Validator**: the check that a generated level is completable and meets the quality rules before it is offered.

## 3. Story and levels

The five levels are the stages of building software, ending in the worst idea in the trade.

| Level | Title | Subtitle on the title card |
|---|---|---|
| 1 | `git init` | *Everything compiles. Suspicious.* |
| 2 | `make` | *14,000 warnings. Ignoring them.* |
| 3 | `npm install` | *Downloading half of the internet.* |
| 4 | `staging` | *Works on my machine.* |
| 5 | `deploy --prod` | *Friday, 16:58.* |

The story is told only on transition screens, never during play:

- **Intro** (start of a run, skippable with any key): a terminal types by itself:
  ```
  $ cat TODO.md
  - [ ] write perfect software
  - [ ] deploy on Friday (what could go wrong)
  $ ./start
  ```
- **Title card** before each level: the level's title and subtitle.
- **Level summary**: presented as a commit, with a random message from a list (`fix bugs (hopefully)`, `remove console.log`, `it works, don't touch it`, …), followed by the score breakdown.
- **Game over**: `Segmentation fault (core dumped)` and a random tip at the bottom (`Tip: have you tried turning it off and on again?`, `Tip: it's not a bug, it's a feature.`, …).
- **Victory** after the boss, a Pyrrhic one:
  1. The screen goes black and a boot log scrolls in theme colours. The numbers are the run's real statistics:
     ```
     [  OK  ] Started perfect_program.service
     [  OK  ] Resolved 47 bugs (3 were features)
     [  OK  ] Reaped all zombie processes
     [  OK  ] Deployed to production. On a Friday.
     ```
  2. `@` walks to a `PRODUCTION` sign while the bits around it burst into fireworks of `0` and `1`.
  3. A big `BUILD PASSED · 0 errors · 0 warnings`.
  4. The punchline: a tiny bug `ж` crawls across the screen, a notification says `1 new issue opened`, `@` turns to look at it, a beat of silence.
  5. A closing line (wording to be settled during implementation; *Thanks for playing. Ship it.* is the placeholder), then the run summary, high score entry and Copy seed.

All texts here are defaults and may be tuned during implementation.

## 4. Hero and movement

- Run left and right, jump with variable height: releasing jump early cuts the jump short.
- Coyote time: a jump is still accepted for a few frames after walking off a ledge.
- Jump buffer: a jump pressed a few frames before landing fires on landing.
- No other abilities in the MVP.
- Physics constants (gravity, run speed, acceleration, jump velocity, jump cut) live in one module. The envelope (maximum jump height, maximum gap at full speed, maximum gap with a height difference) is computed from them, never written by hand.
- Physics runs at a fixed timestep, independent of the display frame rate, so the game plays the same at 60 fps and 144 fps and the validator can simulate it exactly.

## 5. Health, lives and sudo

- A run has **3 lives**. Lives are not refilled by finishing a level.
- A hit while big: the hero shrinks to `@` and blinks, invulnerable for a short moment.
- A hit while small: a life is lost.
- Falling into a pit (`/dev/null`) loses a life whether big or small.
- After losing a life the hero respawns at the last checkpoint (level start or the mid-level checkpoint), small.
- **sudo**: exactly one bit per level holds it. It looks like every other bit. Collected while small: the hero grows to `@@`. Collected while already big: score bonus only (`already root`). The generator always places it on a completable path, possibly in a harder spot.
- sudo carries over into the next level until the hero is hit or loses a life.
- **Checkpoint**: one in the middle of each level, `│▸`, lit when passed (`snapshot saved`).
- No time limit. Time only feeds the score.
- When the last life is lost the run is over: the game over screen offers **Retry this seed from level 1**, **New seed**, **Copy seed** and **Main menu**.

## 6. Enemies and traps

Ten in the MVP. Basic ones appear from level 1; advanced ones join from level 3. Walking enemies turn around at walls, other enemies and ledge edges: they never fall into pits.

### 6.1 Basic

| # | Glyph | Name | Behaviour | Killable |
|---|---|---|---|---|
| 1 | `ж` | bug | Walks back and forth on the ground. | Stomp from above. |
| 2 | `Z` | zombie process | Floats slowly back and forth over a short stretch, bobbing, labelled `<defunct>`. | Stomp from above. |
| 3 | `^^^` | kernel spikes | Static spikes on the ground or on a platform. | No. |
| 4 | `o` | ping | Hops in place at a fixed rhythm. Pass under it while it is up, or jump over it while it is down. | Stomp while it is on the ground. |
| 5 | `▼` | hang | Hangs from a visible thread `│` under the top of the screen. Drops when the hero passes beneath, lies on the ground for a moment, then slowly winds back up. | Stomp while it lies on the ground. |

### 6.2 Advanced

| # | Glyph | Name | Behaviour | Killable |
|---|---|---|---|---|
| 6 | `[*]` | cron job | A vent in the ground fires a column `#####` 3–4 tiles high at a fixed rhythm. 0.5 s before, the vent blinks and `* * * * *` appears above it. Each vent's rhythm and phase come from the seed. | No. |
| 7 | `║ ║`, `}<` | pipe daemon | A pipe; a daemon rises out of its top now and then, stays up briefly and sinks back. The pipe is always visible; the timing has a small seeded jitter. | No. |
| 8 | `*`, `-->` | dangling pointer | An emitter `*` fires `-->` horizontally across the screen, at one or two tiles above the ground. The emitter blinks before each shot. Fires only while on screen. | No. |
| 9 | `&` | fork bomb | Walks like a bug. Stomped, it splits into two small `&` that run in opposite directions, faster, bouncing off obstacles. A small one dies to one stomp and does not split. | Stomp; small ones too. |
| 10 | `%`, `~~~` | memory leak | A source `%` drips and a puddle `~~~` grows from it at a constant speed once it is on screen. Its maximum extent is always drawn as a dotted frame labelled `malloc(n)`, so the player sees how far it will reach. Touching the puddle is a hit. | Stomp the source: the puddle disappears. |

The memory leak's source sits at the far end of its frame, on a one-tile target, so stomping it is about as hard as jumping the whole puddle. Killing it is worth more than any other kill, so it is a real choice rather than always jumping over.

### 6.3 Draft and introduction

- Each run drafts **4 of the 5 basic** and **3 of the 5 advanced**, from the seed. Some surprises are left for later runs.
- Level 1: 2 basic. Level 2: plus 1–2 basic. Level 3: plus 1–2 advanced. Level 4: the rest of the draft. Level 5: a mix of everything drafted, then the boss.
- The first time an enemy appears in a run, it appears in a chunk tagged as a safe introduction: visible from afar, with room to watch it, where a mistake does not kill (no pit beside it).

### 6.4 Messages

Every event shows a short themed message. When the hero is hit or dies, a toast near the top of the screen names what the enemy does to software. A kill shows a small message under the score popup, never intrusive. These are the defaults:

| Source | Hit message | Kill message |
|---|---|---|
| bug | `unhandled exception` | `resolved` |
| zombie process | `<defunct> process attached` | `reaped` |
| kernel spikes | `kernel: stack overflow` | — |
| ping | `request timed out` | `pong` |
| hang | `process not responding` | `kill -9` |
| cron job | `cron: job executed (you)` | — |
| pipe daemon | `broken pipe` | — |
| dangling pointer | `use after free` | — |
| fork bomb | `fork: resource unavailable` | `forked` (big), `wait()` (small) |
| memory leak | `out of memory` | `free()` |
| pit | `/dev/null: write successful` | — |

| Event | Message |
|---|---|
| sudo collected | `sudo: privileges granted` |
| sudo collected while big | `already root` |
| checkpoint | `snapshot saved` |
| boss hit | `core dumped (1/3)`, `(2/3)`, `(3/3)` |
| boss defeated | `kernel: rebooting…` |

## 7. Final boss: KERNEL PANIC

- Level 5 ends in a hand-designed arena one screen wide. The camera locks when the hero enters it; there is no way back.
- A giant face of ASCII art and the text `KERNEL PANIC` fills the top of the arena. It cannot be touched; its attacks can.
- Three attack patterns:
  1. **Falling spikes**: `^` drop from the top; a shadow on the ground marks where each one lands.
  2. **Stack trace**: horizontal lines of stack trace text sweep across at jump heights; each line appears faint first as a warning.
  3. **Spawn**: bugs drop into the arena while one of the other two patterns runs at a lower rate.
- After each attack the boss "dumps core": a `[core]` block appears on the floor for a few seconds at one of a few fixed positions. Stomping it is a hit. If the window is missed, the next attack starts.
- Three hits win. After each hit the boss's attacks speed up.
- The order of attack patterns is random but drawn from the seed, so the same seed always fights the same way and can be learned. Fairness rules: the same pattern never comes three times in a row, and every pattern has a warning.
- Later boss variants are in `ROADMAP.md`; when they exist, the seed chooses one.

## 8. Level generation

### 8.1 Determinism

- One seeded pseudo-random generator per run; each level, each generation attempt and the boss get their own sub-streams derived from the run seed, so changing one level's generation never shifts another's.
- No `Math.random()` in game logic. Tests can inject their own generator.

### 8.2 Assembly

- A level is assembled from chunks: a start chunk, a sequence of body chunks, the checkpoint chunk in the middle, more body chunks and the exit chunk. Level 5 ends in the boss arena instead of an exit.
- Chunks are text tile maps in the source, one character per tile (e.g. `#` ground, `=` platform, `^` spikes, `E` enemy slot). Some cells are parameters the generator fills in: gap widths, platform heights, enemy kinds from the draft.
- The level follows a pacing curve: introduction, build-up, a rest zone, a harder stretch, and never two of the hardest chunks back to back.
- Bits are placed along the intended path and in optional riskier spots. The sudo bit is one of them, chosen from the seed.
- Level width grows with the level number, tuned so a level takes 60–90 seconds.

### 8.3 Physics limits

- Every gap, height and jump the generator places stays within a fraction of the envelope. The fraction is a difficulty parameter.
- Initial difficulty table, to be tuned by playing:

| Level | Max gap (of envelope) | Enemies per screen | Narrowest platform | Rest zones |
|---|---|---|---|---|
| 1 | 45 % | 1 | 4 tiles | every 2 chunks |
| 2 | 55 % | 1.5 | 4 tiles | every 3 chunks |
| 3 | 65 % | 2 | 3 tiles | every 3 chunks |
| 4 | 75 % | 2.5 | 3 tiles | every 4 chunks |
| 5 | 85 % | 3 | 2 tiles | every 4 chunks |

Level 1 should feel like the first level of a classic platformer: easy, readable, teaching. Level 5 must be challenging but always completable.

### 8.4 Validator and quality gate

Before a level is offered, the validator checks it:

- **Reachability**: a search over hero states (position, velocity, facing) using the real physics module finds a path from start to checkpoint to exit, and to the sudo bit.
- **Static hazards** (spikes, pits) are part of that search.
- **Dynamic hazards** (enemies, cron, pipes, pointers, leaks) are safe by construction: each chunk that holds one is verified by its own tests to have a safe passage at every phase of the hazard. The runtime validator checks only that such chunks are placed under the conditions they were verified for.
- **Quality rules**: the difficulty score is within the level's range, rest zones are present, the first appearance of each enemy is in a safe introduction chunk, no blind jumps (every landing is visible before the jump).

If a level fails, the generator tries again with the next attempt's sub-stream. Attempts are deterministic, so the same seed always yields the same level. After a fixed number of failed attempts a built-in safe layout for that level is used. Tests track the first-attempt pass rate over many seeds; the goal is to make it so high that the validator is only a safety net.

## 9. Scoring and high scores

- Points for bits, kills, sudo, boss hits and a time bonus per level. Initial values (tunable): bit 10, kill 100, small fork bomb 50, memory leak 200, sudo 250 (500 when already big), boss hit 1,000, boss defeated 5,000, time bonus per second under the level's par time.
- Local top 10: score, seed, level reached, date. From the list a seed can be copied or started directly.

## 10. Screens, menus and controls

- **Main menu**: Continue (only when a run is in progress), New run, Enter seed, High scores, Settings. There is no quit item: the window is closed like Omatris, from the bar icon or the window manager. Going to the main menu from a run keeps the run for Continue.
- **P**: freeze. The game stops in place with `[ PAUSED ]`; P again resumes.
- **Esc**: in-game menu, pausing the game: Resume, Restart level, Copy seed, Main menu.
- **Closing the window** during play hides it and opens the in-game menu, so nothing runs in the background. Opening it again from the bar shows that menu.
- **Between levels**: the level summary (section 3).
- **Game over** and **victory**: section 3 and section 5. Both offer Copy seed.
- **Enter seed**: type a seed in the `xxxx-xxxx` format (the dash optional); invalid input is rejected with a message.
- **Settings**: Effects (full / reduced).
- Controls: arrows move; Space or Arrow Up jumps; P freezes; Esc opens the in-game menu. Menus are fully keyboard-driven (arrows, Enter or Space), like Omatris.
- The run in progress (for Continue) is kept while the plugin is loaded; it is not written to disk.

## 11. Visuals and theme

- The look of `docs/prototype/demo.html`: a world of glyphs with glow, particles on jumps, landings and kills, score popups, screen shake on hits and stomps, an RGB-split glitch on damage and death, a parallax hexdump background, CRT scanlines and a vignette.
- Colours come from the active Omarchy theme's 16-colour terminal palette, so the game looks like a live terminal in every theme. Omarchy themes name these colours in `colors.toml` the way Omarchy's terminal templates read them: `color0` `background`, `color1`–`color6` `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `color7` `foreground`, `color8` `muted`, `color9`–`color14` the `bright_` variants, `color15` `bright_foreground`. Numbered keys `color0`–`color15` are accepted too and win over the names. A missing bright colour falls back to its normal colour; anything else missing falls back to the shell's colour roles. Colours update live when the theme changes.

| Element | Palette colour |
|---|---|
| Background | theme background |
| Hexdump background | `color8`, faint |
| Ground | `color2` (green) |
| Platforms | `color4` (blue) |
| Solid blocks, stairs | `color5` (magenta) |
| Hero `@` | `color11` (bright yellow) |
| Bits | `color3` (yellow) |
| Checkpoint, exit, pipes | `color6` (cyan) |
| Hostile enemies and traps | `color1` (red), `color9` and `color13` for variety |
| Text, HUD | theme foreground |

- **Effects: full / reduced.** Reduced turns off glow, glitch and CRT. The game switches to reduced by itself when the frame rate stays under 50 fps, and says so once.
- HUD: level `LVL 1/5`, seed, bits, score, time, lives.

## 12. Window and plugin integration

- A bar widget opens and closes the game window, as Omatris does. The plugin stays loaded in the background (`keepLoaded`), but the game is paused whenever the window is hidden.
- The game renders at a fixed logical 960 × 540 and scales to the window, keeping the aspect ratio with bars at the sides or top and bottom. Everyone sees the same part of the level.
- The plugin follows the Omarchy shell plugin manifest (`omarchy plugin validate` must pass).

## 13. Performance

- Target: 60 fps at 1080p on integrated graphics of the Intel HD 620 class (around 2016), with reduced effects at the very least, and full effects wherever the spike shows it is possible.
- The static level is drawn once into an image; each frame draws only what moves.

## 14. Storage

- High scores and settings are stored locally in the plugin's state, like Omatris's high scores.
- Nothing is sent anywhere.

## 15. Tests

- No TDD, but every logic module has tests that run with `node --test`:
  - physics and the envelope;
  - enemy behaviour against the hero and obstacles (turning at walls and edges, stomps, splits, hang drops, leak growth and kill);
  - chunk tests proving each hazard chunk has a safe passage at every phase;
  - generator determinism (same seed, same level);
  - validator: every generated level across many seeds is completable; the first-attempt pass rate is reported;
  - scoring, lives and sudo rules;
  - boss pattern order rules.
- Rendering and menus are tested by playing.

## 16. Language

The game, the code and every file in the repository are in English.

## 17. Out of scope for the MVP

Everything in `ROADMAP.md`.
