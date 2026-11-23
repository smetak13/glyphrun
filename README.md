# Glyphrun

A retro platformer made of ASCII, living in your Omarchy theme. Procedurally generated runs, 10 enemies, one final boss.

Status: in development, not playable yet. See [docs/SPEC.md](docs/SPEC.md), [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) and [ROADMAP.md](ROADMAP.md). Open [docs/prototype/demo.html](docs/prototype/demo.html) in a browser for the visual target.

## Install

```sh
omarchy plugin add https://github.com/smetak13/glyphrun.git --enable
```

Click the `@` in the bar to open and close the game window.

## Development

- `scripts/run-dev.sh` runs the game in a temporary Quickshell window, without installing it. Closing the window quits.
- `scripts/link-dev.sh` symlinks this repository to `~/.config/omarchy/plugins/smetak13.glyphrun`, so the shell loads the working copy. Then enable it with `omarchy plugin enable smetak13.glyphrun`. After changing QML, restart the shell with `omarchy restart shell`.
- `scripts/check.sh` validates the manifest, runs the tests with `node --test`, and loads every logic module in Qt's QML engine (`qml6`), whose JavaScript is older than Node's.
- `node scripts/pass-rate.mjs [seeds]` generates every level for many seeds (200 by default) and reports how many pass the validator on the first attempt, after retries or only with the fallback layout, and which rules failed.
- `node scripts/generate-audio.mjs` regenerates the music and sound effects in `assets/audio/` from the synth in `scripts/audio/`. It needs `ffmpeg`; the output is deterministic.

Game logic lives in `logic/` as plain ES modules with no Qt imports, tested in `tests/`. QML in `ui/` and `Glyphrun.qml` only draws, reads input and calls the logic.

## License

MIT
