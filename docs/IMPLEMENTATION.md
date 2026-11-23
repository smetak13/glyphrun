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

## 11. Terrain, difficulty and run length

- Status: todo

The levels are too easy and the terrain too bland: even level 5 is easy to finish, and a whole run takes about three minutes. Make the generated levels varied and harder, so that even reaching the boss is a challenge, closer to the difficulty of a classic platformer. To be shaped by a grilling session before it starts; the starting points:

- New terrain obstacles and chunks, so each level looks and plays differently every time: more gaps in a row, varied heights, and other terrain features to be decided.
- A higher concentration of hazards and enemies, with the difficulty table and the validator's hazard ranges retuned.
- Combination chunks that put several enemies together on one screen: for example several dangling pointers firing at different heights, or memory leaks in a row with only a small gap between them. Difficulty comes from terrain and enemy combinations together, not from enemies alone.
- To weigh the difficulty a bit when the levels get harder, we will add one sudo powerup somewhere during the boss fight during phase One. The exact form of powerup will be some object (we will discuss it so that it fits to the story) and the object will be moving on the floor until it gets out of screen. After that it disappears. The player has to pick it up in order to apply. It will work as a standard sudo powerup during the game so it will add another @ over the first one. The horizontal moving bars will need to account for the power up option so that it is possible to jump over every obstacle even in the sudo form. Because without the sudo form it is possible to "crawl" under a high bar so with sudo we need to be able to jump over it to make sense.

Tests: to be decided with the scope; at least the validator over a large seed sample, per-chunk safe passage for every new hazard chunk and the pass-rate report.

Done when: generated runs are varied, a full run is challenging to the user, and every level offered is still completable.

## 12. Release preparation

- Status: todo

README with screenshots, controls and install via `omarchy plugin add https://github.com/smetak13/glyphrun.git`, a final pass of `scripts/check.sh`, the plugin description and tags (see `ROADMAP.md`, Publishing), a first tagged release.

Done when: a clean install from GitHub works on the user's machine.
