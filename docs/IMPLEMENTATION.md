# Implementation plan

Spec: `docs/SPEC.md`. Deferred work: `ROADMAP.md`.

Each numbered section is one task and one commit on `main`. Work the tasks in order. When a task is implemented and its tests and checks pass, set its status to `awaiting approval` and stop: the user plays and tests it. Commit only after the user approves, then set the status to `done` in the same commit and start the next task.

Status: `todo` · `in progress` · `awaiting approval` · `done`

## 0. Rendering spike

- Status: done

Decide how the game is drawn, before anything is built on it. In `spikes/rendering/`, render the prototype's scene (`docs/prototype/demo.html`: a scrolling level, about 30 glowing moving glyphs, particles, CRT overlay, glitch) in a Quickshell window two ways: QML `Canvas` with the static level cached as an image, and Qt Quick `Text` items with `MultiEffect` glow. Measure frame times for both, with full and reduced effects, at 1080p. Also confirm that QML can import a plain `.mjs` module that `node --test` can import too.

Done when:
- `docs/spikes/rendering.md` records the measurements, the hardware they were taken on, how to estimate the Intel HD 620 target from them, and the decision.
- The `.mjs` import works from QML and from Node.
- SPEC section 1 names the chosen rendering approach.

## 1. Plugin skeleton and theme

- Status: done

The plugin exists and opens. Manifest (`smetak13.glyphrun`, kinds `bar-widget` and `panel`, `keepLoaded`), bar widget, `FloatingWindow` with the fixed 960 × 540 logical screen scaled to the window, `FrameAnimation` loop with a fixed physics timestep. Theme module: reads `color0`–`color15` from the active theme's `colors.toml`, falls back to shell roles, and updates live on theme change. A hand-written test level (the prototype's layout) is drawn with the chosen renderer. Dev tooling: `scripts/run-dev.sh` (temporary Quickshell window, as Omatris does), `scripts/link-dev.sh` (symlinks the repo to `~/.config/omarchy/plugins/smetak13.glyphrun`), `scripts/check.sh` (`omarchy plugin validate` plus `node --test`). README with install and development instructions.

Tests: theme palette parsing and fallback.

Done when: the window opens from the bar, shows the test level in the current theme's palette, rescales cleanly, and changes colours live with `omarchy theme set`.

## 2. Hero, physics and level basics

- Status: done

The hero plays. Physics module (constants, fixed-step integration, tile collisions) and the envelope computed from it. Input: arrows, Space or Arrow Up to jump, variable jump height, coyote time, jump buffer. Camera following the hero. Pits kill, the checkpoint saves, the exit finishes the level. Bits can be collected. P freezes the game.

Tests: envelope values, variable jump height, coyote time, jump buffer, collisions with walls, floors and ceilings, landing on platform edges, fixed timestep producing identical results at different frame rates.

Done when: the test level can be played from start to exit by keyboard and feels good to the user.

## 3. Run state, HUD and messages

- Status: done

Lives, respawn at the last checkpoint, sudo (grow, shrink on hit with invulnerability blink, carry-over between levels, `already root` bonus), scoring, the HUD, hit and event toasts, kill messages under score popups (SPEC 6.4). Esc in-game menu (Resume, Copy seed, Main menu) and the rule that hiding the window opens it. Copy seed via `wl-copy`.

Tests: lives and respawn rules, sudo rules, score rules, message selection per source.

Done when: on the test level the hero can grow, shrink, die, respawn and lose the run, with the right messages and score.

## 4. Basic enemies

- Status: done

The five basic enemies of SPEC 6.1: bug, zombie process, kernel spikes, ping, hang. Shared enemy framework: placement on tiles, turning at walls, other enemies and ledges, stomp detection, hit detection, kill messages. Each enemy is placed on the test level for playing.

Tests: per enemy, its movement, turning at walls and edges, when it can be stomped and when it hurts; the hang's drop trigger, lying window and wind-up; the ping's rhythm.

Done when: all five behave as the SPEC says on the test level and the user is happy with how they read and feel.

## 5. Level generator

- Status: done

Seeded generator (SPEC 8.1–8.3): seed format and parsing, seeded PRNG with sub-streams, chunk format and the first chunk library (enough variety for levels 1–2 with the basic enemies, including safe introduction and rest chunks), assembly with the pacing curve, checkpoint and exit chunks, bit and sudo placement, the draft of basic enemies and their introduction order, the difficulty table. The game plays generated levels 1–2 instead of the test level.

Tests: same seed gives the same level; different levels and attempts use independent sub-streams; draft and introduction rules; every gap and height stays within the envelope fraction; level widths fit the target duration.

Done when: new seeds give varied, sensible levels 1–2 that the user enjoys playing.

Notes: levels 3–5 are generated too, with basic enemies only. With the current chunks they reach about 2.4–2.5 enemies per screen instead of the table's 2.5–3.5: task 7 adds chunks with more slots. The time bonus still uses the 60 s par from SPEC 9 while level 1 targets 60 s.

## 6. Validator and quality gate

- Status: done

SPEC 8.4: reachability search over hero states with the real physics, static hazards, start → checkpoint → exit and sudo reachability, quality rules, deterministic retries and the safe fallback layout per level. Per-chunk safe-passage tests for every hazard chunk. A script that generates many seeds and reports the first-attempt pass rate and failure reasons.

Tests: the validator rejects hand-made impossible levels for each rule; generated levels over a large seed sample all pass (after retries); hazard chunks have a safe passage at every phase.

Done when: the pass-rate report runs, every level offered is completable, and the first-attempt pass rate is recorded in this task's notes.

Notes: `node scripts/pass-rate.mjs 1000` gives a first-attempt pass rate of 98.5 % (level 1: 96.5 %, 2: 97.3 %, 3: 99.5 %, 4: 99.6 %, 5: 99.4 %). Every failure is the difficulty rule (hazards per screen out of range); no generated level failed reachability, introductions, rest zones or hazard placement. All failed levels pass on a retry; no seed needed the fallback. Validating a level takes about 5 ms in Node and 60–100 ms in the QML engine on the development machine.

## 7. Advanced enemies and levels 3–5

- Status: done

The five advanced enemies of SPEC 6.2: cron job, pipe daemon, dangling pointer, fork bomb, memory leak, with their warnings and messages. Chunks for them, the advanced part of the draft, levels 3–5 in the generator with the full difficulty table, validator support for the new chunks.

Tests: per enemy as in task 4, plus the cron rhythm and warning, pipe timing with jitter, pointer firing only on screen, fork split and the small ones' rules, leak growth to the marked maximum and its kill; per-chunk safe passage for every new hazard chunk; full-run generation over many seeds.

Done when: a full five-level run without the boss can be played from generated seeds.

Notes: after the first round of play, cron lost its warning and its column grew past jump height, the pipe grew to three tiles so an emerged daemon cannot be jumped, small fork bombs dash apart after a split and ignore the hero until it has landed clear of them, and the memory leak became a cycle whose full puddle cannot be jumped: lone leaks are 7 or 10 tiles, small ones come only in a row of three. From level 3 spikes also come as a run of five and as a row of three pairs. `node scripts/pass-rate.mjs 1000` gives a first-attempt pass rate of 95.2 % (level 1: 96.5 %, 2: 97.3 %, 3: 89.5 %, 4: 95.2 %, 5: 97.5 %), every failure on the difficulty rule, no fallback needed. Level 5 reaches about 3.2 enemies per screen with the current chunks, so its table value is 3.25 instead of 3.5. The chunk safe-passage test now covers about 660 chunk and enemy combinations and takes about 18 s.

## 8. KERNEL PANIC

- Status: done

The boss stage after level 5 (SPEC 7): the arena, the transition from level 5's soft win, the face, the three attack patterns with warnings combined two per phase, core dump windows, three hits, speed-up after each hit, seeded phase order with the no-twice-in-a-row rule, hit and defeat messages.

Tests: phase order is deterministic per seed and never repeats a phase twice in a row; every phase runs both its patterns; core window timing; hit counting and speed-up.

Done when: the boss is beatable, fair and fun to the user.

## 9. Run flow, story and screens

- Status: done

Main menu (Continue, New run, Enter seed, High scores, Settings), the intro, level title cards, the commit-style level summary, game over with tips and its four actions, the victory sequence with the boot log from real statistics, the high score table (top 10 with seed, level, date, copy and play) and settings storage.

Tests: seed entry parsing and rejection, high score insertion and ordering, boot log statistics, Continue availability.

Done when: a full run from the main menu through victory or game over works, and the texts read well to the user.

## 10. Effects and sound

- Status: done

The full visual layer of the prototype in the game: glow, particles, score popups, screen shake, glitch on damage and death, parallax hexdump, CRT and vignette. Effects setting (full / reduced) and the automatic switch to reduced under 50 fps with a one-time notice.

Sound, played with Qt Multimedia as Omatris does (`MediaPlayer` with an `AudioOutput` for music, `SoundEffect` for effects):

- The assets already exist and are generated, not hand-made: `node scripts/generate-audio.mjs` (synth and composer in `scripts/audio/`, no npm dependencies, needs `ffmpeg`) writes `assets/audio/music/*.ogg` and `assets/audio/sfx/*.wav`. The output is deterministic. Generator and assets are in the working tree but not committed yet: they go into this task's commit, not into earlier ones.
- Music: retro synthwave loops of 32 bars that loop seamlessly. Ten level tracks `level-01`–`level-10` (96–126 BPM, about 60–80 s) and five faster, harder boss tracks `boss-01`–`boss-05` (150–168 BPM, about 45–50 s). Track list and titles: `scripts/audio/tracks.mjs`.
- Track choice from the seed, on its own sub-stream so it never shifts level generation: the ten level tracks are shuffled per seed and level n plays the n-th one, so a run's five levels always have five different tracks and the same seed always has the same music. The boss stage plays one of the five boss tracks, also chosen by the seed. Music starts with each level, pauses with the game and when the window is hidden, and stops on game over and victory, where their jingles play.
- Effects (`assets/audio/sfx/`): `jump`, `land`, `bit`, `sudo`, `already-root`, `stomp`, `hit`, `death`, `checkpoint`, `level-clear`, `boss-warning`, `boss-hit`, `boss-defeat`, `core-dump`, `game-over`, `victory`, `menu-move`, `menu-select`, `pause`. The logic exposes events (as Omatris's `effectSerial` does) and an `AudioController.qml` plays them, so the logic stays free of QML.
- Settings: music volume, effects volume and mute, stored with the other settings.
- SPEC gets a sound section (the rules above) and section 17 no longer lists sound as out of scope.

Tests: the frame-rate watcher's switching rule; track choice is deterministic per seed, gives five different level tracks per run and does not change any generated level.

Done when: the game looks like `docs/prototype/demo.html` with full effects and stays smooth with reduced effects on weaker hardware, and music and effects play at the right moments, follow the volume settings and fit the game to the user.

Notes: the logic reports what happened as cues on the run (`takeCues`), which drive both the particles, shake, flash and glitch (`logic/effects.mjs`, with its own fixed-seed generator so cosmetics never touch the run's streams) and `ui/AudioController.qml`. The glow needed `MultiEffect` auto-padding off: with a layer texture at physical size, auto-padding drew the glow a few pixels off its glyph. The automatic switch to reduced effects could not be triggered on the development machine, which holds the refresh rate with full effects; its rule is covered by tests only.

After the first round of play: the CRT overlay is about 15 % of its first strength; each effect got its own gain (they were 10–13 dB louder than the music at equal settings, the jump the worst); and unexplained deaths in the boss stage were invisible bugs. The arena drew at most 6 spawned bugs, but a 20 s phase at ×1.2 speed spawns up to 13 and they stay until stomped or the core window ends. The glyph pools now come from `MAX_DROPS`, `MAX_TRACES` and `MAX_BUGS` in `logic/boss.mjs`, and a test checks the longest phases stay within them.

Second round: a death in the boss stage no longer restarts the fight from the first phase. The boss keeps its hits and runs the current phase again (`resumeBoss`); a phase counts as cleared only once its core is stomped. SPEC 7 is updated.

Third round: gameplay looked blurred with full effects while menus were sharp. The glow layers themselves render at full resolution; the haze came from a glow that was too wide and bright over every glyph. The glow is now tight (`blurMax` 8) and faint (opacity 0.35 on moving glyphs, 0.2 on the level).

Fourth round: beating the boss adds 2,000 points for every life left, so lost lives count in the final score. SPEC 9 is updated.

## 11. Spinlock

- Status: done

A new advanced enemy, the spinlock (SPEC 6.2), in the spirit of a rotating fire bar: a pivot `(o)` on the ground or on a block with an arm of 3–5 glyphs (`·` along it, `*` at its tip) turning a full 360°, passing behind ground and blocks. Arm length, direction and starting angle come from the seed; one turn takes about 3 s. It cannot be killed; only the arm hurts, and the pivot is solid to stand on. Hit message `spinlock: deadlock detected`. It is the sixth advanced enemy and the draft takes 4 of the 6 advanced. Chunks for it and first combinations: two spinlocks out of phase on consecutive pillars, a spinlock guarding a landing, a spinlock over a pit.

Tests: arm geometry and rotation over time, direction and phase from the seed, collision only with the arm, standing on the pivot, draft of 4 of 6, per-chunk safe passage for every spinlock chunk, full-run generation over many seeds and the pass-rate report.

Done when: the spinlock reads clearly, is fair and fun to the user, and every level offered is still completable.

Notes: the pivot is a solid tile (`s` in level maps). The spinlocks of one chunk share arm and direction, and a chunk may set them a fixed part of a turn apart (`spinOffset`) and limit the arm lengths (`arms`). After the first round of play the spinlock got variants: arms of up to 7 links and a double arm (a second arm pointing the opposite way). No level rules: each chunk lists the arm lengths it allows (`arms`) and those that may be double (`doubles`), and the seed picks among them. A double arm of 6 or 7 on a ground pivot was passable only through a tiny window (the search needed minutes to find it), so on the ground only arms up to 5 may be double; the floating one allows double arms of every length. Chunks: `spinlock-ground` (arms 3–7), `spinlock-high` (a floating pivot to pass under, arms 4–7), `spinlock-pair` (two half a turn apart, from level 3) and `spinlock-landing` (behind a pit's landing). A spinlock right over a pit is left for task 12, since chunks keep gap columns empty above the ground. The safe-passage test runs every spinlock chunk with every arm length and both directions. With one-slot spinlock chunks in the draft, level 5 holds about 3.1 enemies per screen, so its table value is 3.1 until task 12 retunes it. `node scripts/pass-rate.mjs 1000` gives a first-attempt pass rate of 91.8 % (level 1: 96.5 %, 2: 97.3 %, 3: 88.4 %, 4: 87.4 %, 5: 89.3 %), every failure on the difficulty rule, no fallback needed.

## 12. Terrain, difficulty and run length

- Status: done

The levels are too easy and the terrain too bland: even level 5 is easy to finish, and a whole run takes about three minutes. Make the generated levels varied and harder, closer to the difficulty of a classic platformer, so that reaching the boss feels earned. Shaped in a grilling session:

- Difficulty curve: level 1 a bit harder than now but doable while losing at most one life; level 3 is where it gets challenging; levels 4 and 5 get progressively harder.
- Run length: a clean run without the boss takes about five minutes. The assumed pace goes from 4 to about 7 tiles per second so the 60–84 s level targets hold for a decent player.
- Terrain from existing tiles only (no new tile types): chains of pits, long jumps to 1–2 tile platforms, high and low routes, tunnels whose ceiling blocks the big hero, staircases over pits, drops with a ledge. Moving or crumbling platforms and springs go into `ROADMAP.md`.
- About half the difficulty from terrain and half from enemies. One difficulty score as now, retuned; the chunk library for levels 3–5 gets about as many terrain-hard chunks as enemy-hard ones, plus many combination chunks: dangling pointers at different heights, a row of memory leaks with small gaps, a pointer across a gap, a cron vent on an island between pits, a pipe followed by a leak, a ping on a narrow pillar, spinlock combinations and more. Basic and advanced enemies mix freely from level 3. Every new hazard chunk passes the safe-passage test.
- Difficulty table, to be tuned by playing: max gap 65 / 72 / 80 / 88 / 92 %, narrowest platform 3 / 2 / 2 / 1 / 1 tiles, about 0.5 more enemies per screen from level 2, rest zones a bit less often, hazard ranges retuned. One checkpoint per level as now.
- 1-up: every 100 bits collected over the run (sudo not counted) gives a life, with the toast `fork(): +1 life`, a new generated `one-up` effect and a flash of the HUD lives. At most 9 lives; at the cap it gives 1,000 points instead. `scripts/pass-rate.mjs` also reports bits per level, so the 100 can be tuned. SPEC 5 is updated.
- Boss `[patch]`: a sudo pickup in the first phase only, again each time that phase repeats after a death. It enters at a seeded time 3–6 s into the phase from the arena edge away from the hero, moves along the floor at about half the hero's speed and is gone when it leaves the screen. Collected it works as sudo (`kernel: hotfix applied`, or `already root` while big). Drawn in the bit colour with a glow and a trail of `+` sparkles so it reads as a good thing, with a faint `hotfix` label the first time. The big hero must be able to jump every stack trace bar.
- Boss core arrow: a `▼` above every core that bobs while the window is open and blinks with the core in its last second.

Tests: the validator over a large seed sample, per-chunk safe passage for every new hazard chunk, the pass-rate report, the 1-up rules, the patch's timing, determinism and its phase rule, and the big hero clearing every stack trace bar.

Done when: generated runs are varied, a full run is challenging to the user, and every level offered is still completable.

Notes: chunk maps may now hold platforms, enemy slots and bits above a gap; the gap's own columns stay centred in the widened pit and platforms over it are stretched across, which gives the high route over a pit chain and the spinlock over a pit. A chunk may name kinds per slot (`slotKinds`) for combinations such as a pipe followed by a leak. Each level has a hard share (`hardFrom`, 55 / 50 / 40 / 35 / 30 %) after which the hardest chunks may come, so later levels reach them sooner. New terrain chunks: `pit-chain-long`, `pit-chain-steps`, `stepping-stones`, `pillar-stairs`, `long-jumps`, `cliff-ledge`, `stair-pit`, `tunnel`, `route-split`; new combination chunks: `island-guard`, `ping-pillar`, `pit-guards`, `spike-takeoff`, `pointer-heights`, `pointer-pits`, `leak-chain-tight`, `pipe-leak`, `pipe-guard`, `spinlock-pit`, `spinlock-pointer`, `spinlock-steps`, `stairs-crowd`, `lift-pair`, `pillars-guarded`, `tunnel-guarded`, `pillars-crowd`, `platform-pair`; `gap`, `gap-wide`, `gap-down`, `gap-up`, `platform-climb` and `pillars` got a second slot. `route-split` holds one enemy, on its middle platform: with three, the safe-passage search over two stacked routes took minutes per phase. The terrain chunks are wide with few slots, so levels 4 and 5 reach about 3.3 and 3.45 enemies per screen; their table values are 3.3 and 3.5 instead of 3.5 and 3.6. `node scripts/pass-rate.mjs 1000` gives a first-attempt pass rate of 98.1 % (level 1: 98.1 %, 2: 99.0 %, 3: 97.9 %, 4: 97.5 %, 5: 97.9 %), every failure on the difficulty rule, no fallback needed. A level holds 65–88 bits (380 per run), so a run earns about three 1-ups at 100 bits each. Levels are now 430–600 columns. The safe-passage test covers about 690 chunk and enemy combinations and takes about 50 s. The run tests where an idle hero waits in the boss arena now expect it to pick up the patch.

After the first round of play the levels were still too easy, with too many easy stretches and too few enemies, while the length and the one-tile pillars were right. Lives are capped at 5 instead of 9, and a level's par for the time bonus is its target time. Every level is now harder: the easy start is shorter (`mediumFrom`, 15 / 10 / 10 / 5 / 5 %), the hard part starts sooner (`hardFrom`, 40 / 30 / 25 / 20 / 15 %) and holds no easy chunks, the hardest chunks are weighted up and may come two in a row on levels 4 and 5 (`hardStreak`), and rest chunks come less often. Level 1 gets hard terrain and the dense basic chunks; one-tile pillars come from level 2. Hard terrain now holds enemies: 17 new combination chunks (guards on pit chains and pillar stairs, zombies over pits, hangs on stepping stones, pointers on pillars at different heights, three different spinlocks in a row, spinlocks over the gaps between pillars, hangs before a pointer, cron vents and a pipe on islands, a leak on an island, dense gauntlets of enemies and pits from level 4), and many terrain and advanced chunks got basic enemies through `slotKinds`. Two features serve these: a chunk may give its pointers first-shot delays (`shotDelays`) so they fire out of step, and may set each spinlock's arm, direction and offset (`spinlocks`), the seed choosing the starting angle and mirroring them; the safe-passage test runs such chunks both ways. Enemies per screen are 2.5 / 3.25 / 3.5 / 3.6 / 3.75, about what the chunk slots of levels 3–5 can hold. `route-split` keeps one enemy and `spinlock-ground` doubles only arms of 3 and 4: with more, the safe-passage search took minutes. `node scripts/pass-rate.mjs 1000` gives a first-attempt pass rate of 96.6 % (level 1: 97.7 %, 2: 96.0 %, 3: 96.6 %, 4: 96.5 %, 5: 96.1 %), every failure on the difficulty rule, no fallback needed, and 360 bits per run. The safe-passage test covers about 2,300 combinations and takes about 75 s; the whole check about 95 s.

Third round, for more varied terrain: the ground rolls, each chunk raised by up to 2 / 3 / 4 / 4 / 5 rows (`maxRaise`) in a random walk that keeps every step up within the rise limit, so every chunk comes at many heights. A hang hangs as high above its own ground as on the base ground (`hangRow`), never in the top two rows; the safe-passage test runs hang chunks at each raise where that limit changes their drop. Blocks may now stand over a gap like platforms. Six vertical chunks: `platform-ladder`, `block-tower`, `valley`, `ceiling-pits`, `zombie-heights`, `ping-steps`. The ground fades with depth (`▀`, `▓`, `▒`, `░`). Fixed: the sudo bit could sit in a tunnel, where a small hero growing big was stuck; it is never placed right under a ceiling. `stair-pit` no longer holds spikes, which made its safe-passage search take 43 s. `node scripts/pass-rate.mjs 1000` gives 98.4 % (level 1: 98.4 %, 2: 98.3 %, 3: 98.8 %, 4: 98.5 %, 5: 98.1 %), every failure on the difficulty rule, no fallback, 357 bits per run. The safe-passage test covers about 3,300 combinations and takes about 95 s.

Fourth round: a stomp counts as landing for the jump. Jump pressed just before a stomp or just after it gives a full jump off the enemy (or the boss's core), as off the ground; before, it gave only the weaker stomp bounce.

## 13. Run

- Status: done

Holding Shift makes the hero run, as in classic platformers, as a speedrun option. Shaped in a grilling session:

- Walking stays at today's 9 tiles/s; holding Shift (either one) runs at 12 tiles/s. Above walking speed the hero speeds up gently, reaching running speed in about 0.5 s; releasing Shift brakes back to walking speed with the normal acceleration. The same rule holds in the air, with the air acceleration, so releasing Shift mid-jump shortens the jump. Both speeds are tuning values.
- The jump is as high as before; momentum carries into the air, so a running jump reaches farther.
- The generator, the envelope, the validator and the safe-passage tests stay at walking speed: every level is proven completable without running. Hangs, pointers, the camera and the time-bonus par are not retuned. Running works everywhere, the boss arena included; the boss's patch stays at half the walking speed.
- The `»` trail shows only while running above walking speed.
- **Fastest runs**: High scores gets two tabs, `SCORE` and `TIME`, switched with ←→ on a tab row at the top; ↓ enters the list, which works as before (play or copy a seed). The time table is a top 10 of the playing time to Shipped (finishing level 5), the boss not timed: pauses, menus, cards, summaries and death beats do not count. Entries show the time to hundredths, the seed and the date; on equal times the older entry stays above. The Shipped screen shows a new entry's place (`fastest run #3`). Score is unchanged.
- **Controls**: a read-only screen in the main menu (Continue, New run, Enter seed, High scores, Controls, Settings) and the in-game menu (Resume, Controls, Copy seed, Main menu): ←→ move, Space or ↑ jump (hold for higher), Shift run (hold), P pause, Esc menu, and a muted line on menus. Esc or Enter goes back. Remapping stays in `ROADMAP.md`.

Tests: the ramp to running speed and the braking back, a running jump as high as a walking one but longer, Shift in the air, the envelope at walking speed, no blind jump at running speed, the time table (entry, order, ties, top ten, storage), the menu items.

Done when: running feels good to the user and adds to the game; otherwise the task is reverted.

## 14. Rich ASCII: hero and enemies

- Status: todo

Before implementing, settle the design in a grilling session and write its decisions into this task and `docs/SPEC.md` (section 11, Rich ASCII). Purely visual: physics, hitboxes, the generator, the validator and the chunk tests do not change; everything stays glyphs coloured from the theme palette.

A more interesting hero built from glyphs instead of a single `@`, and lively, animated enemies (all eleven).

## 15. Rich ASCII: level themes

- Status: todo

Before implementing, settle the design in a grilling session and write its decisions into this task and `docs/SPEC.md` (section 11, Rich ASCII). Purely visual: physics, hitboxes, the generator, the validator and the chunk tests do not change; everything stays glyphs coloured from the theme palette.

Each level's terrain looks like its meaning (for `deploy --prod`, server racks and the like), with many design variants of ground, blocks and platforms, about 30 in total, that only change how a tile is drawn.

## 16. Rich ASCII: backgrounds

- Status: todo

Before implementing, settle the design in a grilling session and write its decisions into this task and `docs/SPEC.md` (section 11, Rich ASCII). Purely visual: physics, hitboxes, the generator, the validator and the chunk tests do not change; everything stays glyphs coloured from the theme palette.

Each level gets its own background matching its theme, instead of the shared hexdump.

## 17. Release preparation

- Status: todo

README with screenshots, controls and install via `omarchy plugin add https://github.com/smetak13/glyphrun.git`, a final pass of `scripts/check.sh`, the plugin description and tags (see `ROADMAP.md`, Publishing), a first tagged release.

Done when: a clean install from GitHub works on the user's machine.
