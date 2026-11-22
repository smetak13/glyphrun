# Glyphrun

ASCII platformer as an Omarchy shell (Quickshell) plugin. Read `docs/SPEC.md` for what to build, `docs/IMPLEMENTATION.md` for the task list and `ROADMAP.md` for what is deferred. `docs/prototype/demo.html` is the visual target.

## Workflow

This repo deliberately differs from the user's global rules:

- No chisel and no TDD. Work in tasks, not slices.
- One task in `docs/IMPLEMENTATION.md` = one commit on `main`. No branches, no pull requests.
- Take the first task that is not `done`. Set it to `in progress`, implement all of it, write its tests, run the checks.
- When it is ready, set it to `awaiting approval`, summarise what to try, and stop. The user plays and tests.
- Commit only after the user approves. The commit sets the task to `done` and holds the code, tests and doc updates together.
- If a decision changes the game, update `docs/SPEC.md` in the same task. Anything deferred goes into `ROADMAP.md`.

## Code

- Game logic is pure JavaScript ES modules (`.mjs`) with no QML or Qt imports, so that `node --test` runs it. QML only draws, reads input and calls the logic.
- No `Math.random()` in game logic: use the seeded generator.
- No npm dependencies.
- Everything in the repo is in English.

## Checks

- `scripts/check.sh`: `omarchy plugin validate` and `node --test`. Must pass before a task is marked `awaiting approval`.
- `scripts/run-dev.sh`: run the game in a temporary Quickshell window.

(The scripts are created in task 1.)
