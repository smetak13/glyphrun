# Glyphrun — Specification (MVP)

Glyphrun is a retro side-scrolling platformer made of ASCII, living in your Omarchy theme. It runs as an Omarchy shell (Quickshell) plugin in its own window, like Omatris. Every run is procedurally generated from a seed: five levels, ten kinds of enemies and traps, and a final boss as a bonus stage.

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

- **Run**: one attempt at five levels in a row and the boss stage after them, started from a seed. Holds lives, score, the sudo state and the drafted enemy set.
- **Seed**: 8 hex digits shown as `7f3a-91c2`. The seed alone determines every level layout, every enemy placement, the drafted enemy set and the boss's attack order. Two players on the same seed get the same game.
- **Level**: a horizontally scrolling stage about 60–90 seconds long for a decent player, one screen tall. Levels 1–5, each ending at an exit.
- **Boss stage**: the one-screen arena of KERNEL PANIC after level 5 (section 7). Finishing level 5 already wins the run softly; beating the boss is the true win.
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
- **Game over**: `Segmentation fault (core dumped)`, the cause of the last death with the level reached, and a random tip at the bottom (`Tip: have you tried turning it off and on again?`, `Tip: it's not a bug, it's a feature.`, …).
- **Shipped**: finishing level 5 is a soft win. Its summary shows the run's score like any other level, then a transition screen:
  ```
  $ deploy --prod
  Deploying to production... done.
  [  OK  ] Shipped. On a Friday.

  $ uptime
   16:59:58 up 0 min, 1 user

  [    0.000000] Kernel panic - not syncing: Fatal exception
  [    0.000001] ---[ end Kernel panic ]---
  ```
  `Space · face it` starts the boss stage.
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
- Ground and solid blocks stop the hero from every side. Platforms `[===]` are one-way: the hero jumps up through them and lands on top.
- The hero stands on a ledge as long as any part of it is over the ledge, so the widest gap it can clear is the distance flown plus its own width.
- Physics constants (gravity, run speed, acceleration, jump velocity, jump cut) live in one module. The envelope (maximum jump height, maximum gap at full speed, maximum gap with a height difference) is computed from them, never written by hand: by simulating a full-speed jump with jump held, taken from the ground without coyote time.
- Physics runs at a fixed timestep, independent of the display frame rate, so the game plays the same at 60 fps and 144 fps and the validator can simulate it exactly.

## 5. Health, lives and sudo

- A run has **3 lives**. Lives are not refilled by finishing a level.
- A hit while big: the hero shrinks to `@` and blinks, invulnerable for a short moment.
- A hit while small: a life is lost.
- Falling into a pit (`/dev/null`) loses a life whether big or small.
- After losing a life the hero respawns at the last checkpoint (level start or the mid-level checkpoint), small, after a short death beat (1.2 s). Bits already collected stay collected.
- The invulnerability after shrinking lasts 1.5 s. A pit costs a life even while invulnerable.
- The big hero is about two tiles tall and bumps its head on ceilings that the small one passes under.
- **sudo**: exactly one bit per level holds it. It looks like every other bit. Collected while small: the hero grows to `@@`. Collected while already big: score bonus only (`already root`). The sudo bit scores as sudo, not as a bit, and is not counted among the bits. The generator always places it on a completable path, possibly in a harder spot.
- sudo carries over into the next level until the hero is hit or loses a life.
- **Checkpoint**: one in the middle of each level, `│▸`, lit when passed (`snapshot saved`).
- No time limit. Time only feeds the score.
- Losing the last life shows no toast: after the death beat the game over screen names the cause and the level (`/dev/null: write successful · level 2/5`).
- When the last life is lost the run is over: the game over screen offers **Retry this seed from level 1**, **New seed**, **Copy seed** and **Main menu**.

## 6. Enemies and traps

Ten in the MVP. Basic ones appear from level 1; advanced ones join from level 3. Walking enemies turn around at walls, other enemies and ledge edges: they never fall into pits.

### 6.1 Basic

| # | Glyph | Name | Behaviour | Killable |
|---|---|---|---|---|
| 1 | `ж` | bug | Walks back and forth on the ground. | Stomp from above. |
| 2 | `Z` | zombie process | Floats slowly back and forth over a short stretch, bobbing, labelled `<defunct>`. | Stomp from above. |
| 3 | `^^^` | kernel spikes | Static spikes on the ground or on a platform. | No. |
| 4 | `o` | ping | Hops in place at a fixed rhythm. Pass under it while it is up, or jump over it while it is down. | Stomp from above, on the ground or mid-hop. |
| 5 | `▼` | hang | Hangs from a visible thread `│` under the top of the screen. Drops when the hero comes within about five tiles, timed to land on a hero running at full speed; braking when it starts to drop avoids it. It falls through platforms and lands only on the ground or a solid block, so a platform is no shelter. Lies there for a moment, then slowly winds back up. | Stomp from above, falling, lying or winding up. |

### 6.2 Advanced

| # | Glyph | Name | Behaviour | Killable |
|---|---|---|---|---|
| 6 | `[*]` | cron job | A vent on the ground fires a column `#####` 5–6 tiles high, higher than any jump, at a fixed rhythm, for 1 s. There is no warning: the player learns each vent's rhythm and passes while it is off. Each vent's rhythm (every 2.4, 3 or 3.6 s), phase and height come from the seed. The vent itself is harmless. | No. |
| 7 | `║ ║`, `}<` | pipe daemon | A solid pipe two tiles wide and three tall; a daemon rises 1.5 tiles out of its top now and then, stays up for 1 s and sinks back. With the daemon out its top is higher than any jump, so the pipe can only be crossed while it is down. Standing on the pipe while the daemon is up is a hit. The pipe is always visible; the time down is 1.8 s plus a seeded jitter of up to 0.5 s per cycle. | No. |
| 8 | `*`, `<--` | dangling pointer | An emitter `*`, on the ground or on a block, fires `<--` to the left, towards the arriving hero, across the screen until a wall stops it: in the lowest tile row above the ground (jump it) or in the second (the small hero passes under, the big one must jump). The emitter blinks 0.5 s before each shot and fires every 2.5 s, only while on screen. Touching the emitter is a hit. | No. |
| 9 | `&` | fork bomb | Walks like a bug. Stomped, it splits into two small `&` that run in opposite directions, faster, bouncing off obstacles. For 0.3 s after the split the small ones dash apart faster than the hero runs. Until the hero has landed from the stomp's bounce and stands clear of them, they neither hurt nor die, so one stomp never kills them too. A small one dies to one stomp and does not split. | Stomp; small ones too. |
| 10 | `%`, `~~~` | memory leak | A source `%` drips and a puddle `~~~` grows from it towards the arriving hero. From the moment it first comes on screen it repeats a cycle: grows at 3 tiles per second to its maximum extent, stays full for 0.8 s, dries back to the source at 4 tiles per second and stays dry for 0.6 s. Its maximum extent is always drawn as a dotted frame labelled `malloc(n)`, so the player sees how far it will reach. A lone leak is big: 7 tiles, or 10 from level 4, so a full puddle is wider than any jump and the player waits for it to dry back. Smaller leaks (3 tiles) come only as a row of three with 2-tile gaps between them. Touching the puddle is a hit. | Stomp the source: the puddle disappears. |

"On screen" is judged against the camera. A stomp bounces the hero up; holding jump makes the bounce higher, like a jump. Touching a killable enemy is a stomp when the hero was above it a moment before, even if the enemy is moving up into the hero; otherwise it is a hit. Spikes always hit. After the hero loses a life, the enemies still alive return to where they started; killed ones stay dead.

The memory leak's source sits at the far end of its frame, on a one-tile target, so stomping it is about as hard as jumping the remaining puddle. Killing it is worth more than any other kill, so it is a real choice rather than always jumping over.

### 6.3 Draft and introduction

- Each run drafts **4 of the 5 basic** and **3 of the 5 advanced**, from the seed. Some surprises are left for later runs.
- Level 1: 2 basic. Level 2: plus 1–2 basic. Level 3: plus 1–2 advanced. Level 4: the rest of the draft. Level 5: a mix of everything drafted.
- The first time an enemy appears in a run, it appears in a chunk tagged as a safe introduction: visible from afar, with room to watch it, where a mistake does not kill (no pit beside it). One introduction chunk serves every enemy except the memory leak, which has its own so that it is introduced at full size.

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
| boss: falling spike | `kernel: stack overflow` | — |
| boss: stack trace | `Call Trace: you+0x0/0x1` | — |

| Event | Message |
|---|---|
| sudo collected | `sudo: privileges granted` |
| sudo collected while big | `already root` |
| checkpoint | `snapshot saved` |
| boss hit | `core dumped (1/3)`, `(2/3)`, `(3/3)` |
| boss defeated | `kernel: rebooting…` |

## 7. Final boss: KERNEL PANIC

- A bonus stage after level 5, in the spirit of a secret final act: the run is already won softly (section 3), and beating the boss is the true win. It is meant to be hard: an experienced player should need several tries and learn the seed's phase order, but it is always winnable.
- The arena is one screen of flat ground; the hero starts at its left. The HUD shows `BOSS` instead of the level.
- A giant face of ASCII art and the text `KERNEL PANIC` fills the top of the arena, with the hits so far as `[ ■□□ ]`. It cannot be touched; its attacks can. The face changes while it dumps core and after it is beaten.
- Three attack patterns:
  1. **Falling spikes**: `^` appear faint under the face with a shadow `▁▁` on the ground where they will land, drop after 0.85 s, and keep coming every 0.55 s. Every other one aims at the hero's column. They hit only while falling.
  2. **Stack trace**: bars of stack trace text (`panic+0x5c`, …) four tiles long sweep across the arena, one every 1.1 s, in the lowest tile row above the ground (jump it) or the second (the small hero stays under it, the big one must jump). Each bar shows faint and harmless for 0.8 s at the arena edge before it moves. Within one phase all bars come from the same side, so two never reach the hero at once.
  3. **Spawn**: bugs drop into the arena every 1.5 s at random places, marked by a shadow like the spikes. A dropping bug hurts; once landed it walks and can be stomped as usual. Bugs left over vanish when the core window ends.
- The fight is a sequence of phases, and **every phase combines two patterns** at full rate: spikes + stack trace, spikes + spawn or stack trace + spawn. The fight starts 2 s after the stage begins. A phase emits its hazards for 6 s and ends when the last one is gone.
- After each phase the boss "dumps core": a `[core]` block appears on the floor for 3.5 s at one of three fixed positions (the arena's left, middle and right), blinking in its last second. Stomping it is a hit and bounces the hero; touching it from the side does nothing. If the window is missed, the next phase starts after a 1 s pause, as it does after a hit.
- Three hits win. Each hit speeds the attacks up (×1.2, then ×1.4): their rhythm, warnings, falls and sweeps. The core window does not shrink. After the third hit the face dies, then `kernel: rebooting…`, and the victory follows.
- The order of phases is random but drawn from the seed, so the same seed always fights the same way and can be learned. Fairness rules: the same phase never comes twice in a row, and every pattern has a warning. A phase's place in the order does not depend on hits or misses: the n-th phase of a seed is always the same combination, and hits only set its speed, so a player can learn the order at base speed.
- Lives and sudo carry into the boss stage. Losing a life respawns the hero at the arena's start and the fight starts over: no hits, the same phase order from the beginning. Losing the last life ends the run with the game over screen, as anywhere else.
- All timings are tuning values.
- Later boss variants are in `ROADMAP.md`; when they exist, the seed chooses one.

## 8. Level generation

### 8.1 Determinism

- One seeded pseudo-random generator per run; each level, each generation attempt and the boss get their own sub-streams derived from the run seed, so changing one level's generation never shifts another's. The draft has its own sub-stream too.
- No `Math.random()` in game logic. Tests can inject their own generator.

### 8.2 Assembly

- A level is assembled from chunks: a start chunk, a sequence of body chunks, the checkpoint chunk in the middle, more body chunks and the exit chunk.
- Chunks are text tile maps in the source (`logic/chunks.mjs`), one character per tile, bottom-aligned on the level's three ground rows: `#` ground, `B` block, `=` platform. Some cells are parameters the generator fills in:
  - `G`: a gap in the ground. Each run of gap columns becomes a pit as wide as the generator draws from the chunk's range, cut to the level's envelope fraction; a bit is placed over its middle.
  - `P`: a platform the generator may lift by up to the chunk's `lift` rows, together with everything above it, as long as it stays within the rise limit.
  - `E`: an enemy slot. Filled with a drafted, already introduced kind, or left empty, so the level holds about its number of enemies per screen. A chunk may restrict the kinds; an unrestricted slot holds a basic enemy or a fork bomb, and the other advanced enemies appear only in chunks made for them. A run of slots becomes spikes as wide as the run; a pipe stands on the first two slots of a run and rises three tiles; a memory leak fills the run with its frame and sits at its right end; any other kind stands in its middle, and a hang hangs high above it.
  - A chunk may say that its slots go together: they are filled all with one kind or all left empty (a row of small leaks never appears as a single one).
  - A chunk may name the first level it appears in, to keep levels 1–2 as they are while later levels get denser chunks.
- After the layout, each cron vent and pipe draws its rhythm from the level's sub-stream.
  - `*` and `+`: bits on the intended path and in riskier spots.
- The level follows a pacing curve: introduction, build-up, a rest zone, a harder stretch, and never two of the hardest chunks back to back.
- Bits are placed along the intended path and in optional riskier spots. The sudo bit is one of them, chosen from the seed: a riskier one half of the time.
- The first fifth of a level uses only the easiest body chunks, up to 55 % of it medium ones too, and the rest all of them. The hardest chunks combine hazards: an enemy at a gap's landing, a hang over it, spikes on an island between pits, a chain of pits, a run of five spikes, a row of three spike pairs with two tiles between them. A rest chunk follows every few body chunks (the table below), and the new enemies of the level are introduced right after the start, one introduction chunk each.
- Level width grows with the level number, tuned so a level takes 60–90 seconds (a body chunk that could push the level over 90 seconds is not chosen): its target time (the table below) at an assumed pace of 4 tiles per second for a decent player, about half of the hero's top speed. Both are tuning values.

### 8.3 Physics limits

- Every gap, height and jump the generator places stays within a fraction of the envelope. The fraction is a difficulty parameter: a pit is at most that fraction of the widest gap the hero can clear at the pit's rise (`maxGapByRise`).
- Heights have a fixed limit instead: no step up the ground and no platform is more than one tile below the maximum jump height above what the hero stands on (3 tiles with the current physics).
- Initial difficulty table, to be tuned by playing:

| Level | Max gap (of envelope) | Enemies per screen | Narrowest platform | Rest zones | Target time | Hazards per screen |
|---|---|---|---|---|---|---|
| 1 | 60 % | 1.5 | 4 tiles | every 3 chunks | 60 s | 2–3.5 |
| 2 | 65 % | 2 | 3 tiles | every 3 chunks | 66 s | 2.5–4 |
| 3 | 72 % | 2.5 | 3 tiles | every 4 chunks | 72 s | 3–4.5 |
| 4 | 80 % | 3 | 2 tiles | every 4 chunks | 78 s | 3.25–4.5 |
| 5 | 88 % | 3.25 | 2 tiles | every 5 chunks | 84 s | 3.5–4.75 |

The narrowest platform also limits ground islands between two pits. Hazards per screen is the validator's difficulty score (section 8.4).

Level 1 should feel like the first level of a classic platformer: readable and teaching, but not a walk. Level 5 must be challenging but always completable.

### 8.4 Validator and quality gate

Before a level is offered, the validator checks it:

- **Reachability**: a search over hero states (position, velocity, facing) using the real physics module finds a path from start to checkpoint and from checkpoint to exit for the small hero (it respawns small), from start to exit for the big hero (it may carry sudo in from the last level, and it bumps its head where the small one does not), and to the sudo bit. The search steps the physics exactly, from the hero's standing state, through a fixed set of moves: walking, waiting, and jumps of three heights, steering forward, back or braking in the air. Similar states are merged, but each keeps the real state it was reached in, so every path found is one a player can play; the search may only miss paths, never invent them.
- **Static hazards** (spikes, pits) are part of that search.
- **Dynamic hazards** (enemies, cron, pipes, pointers, leaks) are safe by construction: each chunk that holds one is verified by its own tests to have a safe passage at every phase of the hazard, with every enemy it can hold. The tests run the same search with the enemies moving, from a standing start in front of the chunk, at phases a quarter second apart. During the phase the chunk counts as on screen, so pointers have fired and leaks have grown; a shot already at the hero's start is dropped, since a player would have seen it coming. The runtime validator checks only that such chunks are placed under the conditions they were verified for: every enemy stands in a chunk that may hold its kind, and every pit is within the level's limit.
- **Quality rules**: the difficulty score, hazards per screen (enemies and pits per 40 columns), is within the level's range (table in 8.3), rest zones are present, the first appearance of each enemy is in a safe introduction chunk and no enemy appears before its level.
- **No blind jumps**: every landing is visible before the jump. This holds by the geometry rather than by a check: a level is one screen tall, and the camera shows about 25 tiles ahead of the hero even when lagging at full speed, while the longest jump is under 7 tiles.

If a level fails, the generator tries again with the next attempt's sub-stream. Attempts are deterministic, so the same seed always yields the same level. After 8 failed attempts a safe layout for that level is used: the same assembly from the seed, but with only the easiest body chunks without pits. Its difficulty may fall under the range; everything else passes. Tests track the first-attempt pass rate over many seeds; the goal is to make it so high that the validator is only a safety net. `scripts/pass-rate.mjs` reports it.

## 9. Scoring and high scores

- Points for bits, kills, sudo, boss hits and a time bonus per level. Initial values (tunable): bit 10, kill 100, small fork bomb 50, memory leak 200, sudo 250 (500 when already big), boss hit 1,000, boss defeated 5,000, time bonus of 20 per whole second under the level's par time (60 s until the generator sets a par per level).
- Local top 10: score, seed, level reached, date. From the list a seed can be copied or started directly.

## 10. Screens, menus and controls

- **Main menu**: Continue (only when a run is in progress), New run, Enter seed, High scores, Settings. There is no quit item: the window is closed like Omatris, from the bar icon or the window manager. Going to the main menu from a run keeps the run for Continue.
- **P**: freeze. The game stops in place with `[ PAUSED ]`; P again resumes.
- **Esc**: in-game menu, pausing the game: Resume, Copy seed, Main menu. There is no restart of a single level: a run is one attempt, and starting over means retrying the seed from level 1.
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
