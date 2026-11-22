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

- Status: todo

The five basic enemies of SPEC 6.1: bug, zombie process, kernel spikes, ping, hang. Shared enemy framework: placement on tiles, turning at walls, other enemies and ledges, stomp detection, hit detection, kill messages. Each enemy is placed on the test level for playing.

Tests: per enemy, its movement, turning at walls and edges, when it can be stomped and when it hurts; the hang's drop trigger, lying window and wind-up; the ping's rhythm.

Done when: all five behave as the SPEC says on the test level and the user is happy with how they read and feel.

## 5. Level generator

- Status: todo

Seeded generator (SPEC 8.1–8.3): seed format and parsing, seeded PRNG with sub-streams, chunk format and the first chunk library (enough variety for levels 1–2 with the basic enemies, including safe introduction and rest chunks), assembly with the pacing curve, checkpoint and exit chunks, bit and sudo placement, the draft of basic enemies and their introduction order, the difficulty table. The game plays generated levels 1–2 instead of the test level.

Tests: same seed gives the same level; different levels and attempts use independent sub-streams; draft and introduction rules; every gap and height stays within the envelope fraction; level widths fit the target duration.

Done when: new seeds give varied, sensible levels 1–2 that the user enjoys playing.

## 6. Validator and quality gate

- Status: todo

SPEC 8.4: reachability search over hero states with the real physics, static hazards, start → checkpoint → exit and sudo reachability, quality rules, deterministic retries and the safe fallback layout per level. Per-chunk safe-passage tests for every hazard chunk. A script that generates many seeds and reports the first-attempt pass rate and failure reasons.

Tests: the validator rejects hand-made impossible levels for each rule; generated levels over a large seed sample all pass (after retries); hazard chunks have a safe passage at every phase.

Done when: the pass-rate report runs, every level offered is completable, and the first-attempt pass rate is recorded in this task's notes.

## 7. Advanced enemies and levels 3–5

- Status: todo

The five advanced enemies of SPEC 6.2: cron job, pipe daemon, dangling pointer, fork bomb, memory leak, with their warnings and messages. Chunks for them, the advanced part of the draft, levels 3–5 in the generator with the full difficulty table, validator support for the new chunks.

Tests: per enemy as in task 4, plus the cron rhythm and warning, pipe timing with jitter, pointer firing only on screen, fork split and the small ones' rules, leak growth to the marked maximum and its kill; per-chunk safe passage for every new hazard chunk; full-run generation over many seeds.

Done when: a full five-level run without the boss can be played from generated seeds.

## 8. KERNEL PANIC

- Status: todo

The boss arena at the end of level 5 (SPEC 7): camera lock, the face, the three attack patterns with warnings, core dump windows, three hits, speed-up after each hit, seeded pattern order with the no-three-in-a-row rule, hit and defeat messages.

Tests: pattern order is deterministic per seed and never repeats a pattern three times in a row; core window timing; hit counting and speed-up.

Done when: the boss is beatable, fair and fun to the user.

## 9. Run flow, story and screens

- Status: todo

Main menu (Continue, New run, Enter seed, High scores, Settings), the intro, level title cards, the commit-style level summary, game over with tips and its four actions, the victory sequence with the boot log from real statistics, the high score table (top 10 with seed, level, date, copy and play) and settings storage.

Tests: seed entry parsing and rejection, high score insertion and ordering, boot log statistics, Continue availability.

Done when: a full run from the main menu through victory or game over works, and the texts read well to the user.

## 10. Effects

- Status: todo

The full visual layer of the prototype in the game: glow, particles, score popups, screen shake, glitch on damage and death, parallax hexdump, CRT and vignette. Effects setting (full / reduced) and the automatic switch to reduced under 50 fps with a one-time notice.

Tests: the frame-rate watcher's switching rule.

Done when: the game looks like `docs/prototype/demo.html` with full effects and stays smooth with reduced effects on weaker hardware.

## 11. Release preparation

- Status: todo

README with screenshots, controls and install via `omarchy plugin add https://github.com/smetak13/glyphrun.git`, a final pass of `scripts/check.sh`, the plugin description and tags (see `ROADMAP.md`, Publishing), a first tagged release.

Done when: a clean install from GitHub works on the user's machine.
