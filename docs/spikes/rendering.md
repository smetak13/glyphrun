# Rendering spike

IMPLEMENTATION task 0. Question: draw Glyphrun with QML `Canvas` (Context2D) or with Qt Quick `Text` items and `MultiEffect`?

**Decision: Qt Quick items with `MultiEffect`.** Canvas cannot draw glow at playable frame rates, and even without glow it is CPU-bound with too little headroom for the target machine. Qt Quick items hold the display refresh rate with full effects while using about 1 ms of GPU time and under 1 ms of CPU time per frame.

## The scene

`spikes/rendering/` renders the prototype's scene (`docs/prototype/demo.html`) in a Quickshell `FloatingWindow`, both ways, driven by the same logic module:

- `scene.mjs`: pure ES module with the level, hexdump, 30 moving glyphs (bugs, zombies with `<defunct>` labels, bits, pings, hangs with threads) plus the big hero `@@`, a pool of 80 particles fed by a burst every 0.35 s, a camera scrolling at running speed across a 160-tile level, and a glitch with screen shake for 0.45 s of every 2.5 s.
- `CanvasRenderer.qml`: the static level and both parallax hexdump layers are painted once into offscreen canvases and kept as images; each frame draws three image bands plus the moving glyphs. Glow is Context2D `shadowBlur`, as in the prototype.
- `ItemsRenderer.qml`: one `Text` item per glyph. The static level and the hexdump layers are cached with `layer.enabled` and only move. Glow is a `MultiEffect` blur drawn under a layer of the sharp glyphs: cached once for the level, redrawn every frame for the moving glyphs.
- Shared by both: HUD as `Text` items, glitch (`ShaderEffectSource` of the scene, red and cyan `MultiEffect` copies offset by ±6 px, 8 displaced horizontal slices), CRT scanlines and vignette as a `Canvas` painted once.
- Full effects = glow, glitch, CRT. Reduced = none of them.

The scene is denser than a real level: 30 glyphs and the particles are always on screen.

Run a measurement with `spikes/rendering/run.sh canvas|items|empty full|reduced [seconds]`. `SPIKE_DISPLAY=edp` (default) opens a floating window of 960 × 540 logical px on the internal panel, `SPIKE_DISPLAY=hdmi` a fullscreen window on the external monitor. `SPIKE_CANVAS_STRATEGY=immediate|threaded|cooperative` picks the Canvas render strategy. Each run warms up for 3 s, measures, and prints frame intervals, GUI-thread update time, Canvas paint time and painted frames per second, AMD GPU busy % and clock, and the scene graph render thread timings.

## Hardware

- Laptop: AMD Ryzen 7 7840HS, Radeon 780M iGPU (12 CUs, clock states 800 / 1100 / 2700 MHz), plus an NVIDIA RTX 4060 Max-Q that Qt does not use.
- Quickshell 0.3.2, Qt 6.12.0, OpenGL RHI backend on the Radeon 780M (Mesa 26.2.5, radeonsi), Hyprland 0.56.2.
- **eDP**: the internal 2880 × 1800 panel at 120 Hz, scale 2, driven by the Radeon. A 960 × 540 logical window is exactly 1920 × 1080 physical pixels.
- **HDMI**: an external 1920 × 1080 monitor at 60 Hz, scale 1, fullscreen window. Its port is on the NVIDIA card, so every frame is copied between GPUs.
- The GPU stayed at its lowest clock state (800 MHz) in every run.

## Measurements

All runs render 1920 × 1080 physical pixels with vsync, measuring for 10 s (Canvas runs 6 s). Frame interval = time between game loop frames (`FrameAnimation.frameTime`). GPU busy = mean of `gpu_busy_percent` sampled every 0.1 s, for the whole GPU including the compositor; the `empty` run (a window that changes one pixel per frame) is the baseline.

### Qt Quick items

| Display | Effects | Frame mean | p95 | p99 | max | GPU busy | Game GPU time / frame |
|---|---|---|---|---|---|---|---|
| eDP 120 Hz | full | 8.33 ms | 9.10 | 9.50 | 12.3 | 50.6 % | 0.93 ms |
| eDP 120 Hz | reduced | 8.33 ms | 8.71 | 9.30 | 9.9 | 42.1 % | 0.22 ms |
| eDP 120 Hz | empty baseline | 8.50 ms | 8.63 | 15.5 | 38.5 | 39.4 % | — |
| HDMI 60 Hz | full | 16.67 ms | 27.0 | 29.5 | 31.7 | 33.7 % | 1.50 ms |
| HDMI 60 Hz | reduced | 16.67 ms | 17.45 | 18.7 | 21.0 | 27.9 % | 0.53 ms |
| HDMI 60 Hz | empty baseline | 16.67 ms | 17.32 | 18.3 | 25.7 | 24.7 % | — |

Game GPU time = (busy − baseline busy) × frame interval, at 800 MHz.

- CPU per frame: game logic update 0.3 ms on the GUI thread, scene graph render thread 0.4 ms of CPU (the rest of its time is waiting for vsync).
- Glitch frames are no slower than the others (eDP full: glitch p95 9.0 ms, calm p95 9.1 ms).
- Without vsync (`QSG_NO_VSYNC=1`) on HDMI both modes ran at a steady 8 ms per frame (p99 under 9 ms). Something still capped the rate there, presumably Wayland frame callbacks, so this shows headroom but not the limit.

### Canvas

| Display | Strategy | Effects | Frames painted / s | GUI paint (JS) / frame |
|---|---|---|---|---|
| eDP 120 Hz | threaded | full | 15.7 | 9.8 ms |
| eDP 120 Hz | threaded | reduced | 86.0 | 9.5 ms |
| eDP 120 Hz | immediate | full | 13.7 | 10.0 ms |
| eDP 120 Hz | immediate | reduced | 48.6 | 8.7 ms |
| HDMI 60 Hz | threaded | full | 3.2 | 10.5 ms |
| HDMI 60 Hz | threaded | reduced | 59.9 | 8.4 ms |
| HDMI 60 Hz | immediate | full | 2.9 | 9.7 ms |
| HDMI 60 Hz | immediate | reduced | 56.2 | 8.6 ms |

- Canvas rasterises on the CPU (`QPainter`) and uploads a full-screen texture every frame. Issuing the drawing commands from JS alone takes 8.5–10 ms per frame; rasterising comes on top (in the canvas thread with `threaded`, in the GUI thread with `immediate`).
- `shadowBlur` glow brings a frame to 65–330 ms. The HDMI runs are worse because the window is scaled 2× there, which doubles the blur radius.
- The `cooperative` strategy was slower than `threaded` (18.8 ms mean, p95 29.6 ms on eDP, reduced).
- With `threaded` the game loop keeps running and the canvas silently drops frames, which is why frames painted per second is the honest figure.

## Estimating the Intel HD 620 target

The target is 60 fps at 1080p on an Intel HD 620 laptop (Core i5-7200U class), so the budget is 16.7 ms per frame, shared with the compositor.

The hardware figures below are approximate public numbers, not measured here:

- **GPU**: the HD 620 has 24 EUs at up to about 1.05 GHz, about 0.4 TFLOPS FP32, on shared DDR4-2133 memory (about 34 GB/s dual channel, half that in single-channel laptops). The Radeon 780M at the 800 MHz measured here has 768 shaders, about 1.2 TFLOPS, on DDR5 memory with roughly 2–3× the bandwidth. Blur and layers are bound by fill rate and bandwidth, so scale the measured GPU time by **3–6×**.
- **CPU**: the i5-7200U's single-thread speed is roughly 2–2.5× lower than the Ryzen 7 7840HS. Scale CPU time by **2.5×**.

Method: take the game GPU time per frame (busy minus the `empty` baseline, times the frame interval, at the measured clock), multiply by the GPU factor and add CPU time multiplied by the CPU factor. Use the worse of the two displays.

| Renderer | Effects | GPU on HD 620 | CPU on i5-7200U | Verdict |
|---|---|---|---|---|
| Items | full | 4.5–9 ms | ~2 ms | 60 fps likely, depends on the compositor's load |
| Items | reduced | 1.5–3 ms | ~2 ms | 60 fps with a wide margin |
| Canvas | reduced | — | ≥ 21 ms for the JS commands alone | under 50 fps |
| Canvas | full | — | 150 ms or more | unplayable |

This is an estimate. GPU busy % is a coarse, sampled counter, and the real game will have fewer glyphs on screen than this scene. The automatic switch to reduced effects under 50 fps (SPEC 11) covers machines where full effects do not fit.

## Decision

- Draw the game with Qt Quick `Text` items, positioned each frame from the logic modules' state.
- Cache everything static (level, hexdump background) with `layer.enabled`, giving `layer.textureSize` the size in physical pixels (logical size × game scale × device pixel ratio). Without that the cache is blurry when the window is scaled or on HiDPI screens.
- Glow: a `MultiEffect` blur under the sharp layer. Glitch: a `ShaderEffectSource` of the scene with `MultiEffect` copies. CRT: a static overlay painted once. All three are off in reduced mode.
- `Canvas` only for images painted once, such as the CRT overlay.
- No custom shaders: `qsb` is not installed with the Omarchy shell, so effects stay within `MultiEffect`, `ShaderEffectSource` and the default `ShaderEffect`.

## `.mjs` modules in QML and Node

- `import "scene.mjs" as Scene` works from QML, including `import { … } from "./other.mjs"` inside the module. `node --test` imports the same file (`spikes/rendering/scene.test.mjs`).
- **QML's JavaScript engine (Qt 6.12) is older than Node's.** Probed in Quickshell:
  - Works: `let`/`const`, arrow functions, template literals, destructuring with defaults, array spread, plain classes with getters and static methods, generators, `**`, `?.`, `??`, numeric separators, `Map`, `Set`, typed arrays, `Math.imul`, `Object.assign`, `Object.entries`, `Object.values`, `Array.prototype.includes`, `padStart`, `padEnd`.
  - Fails to load: object spread `{ ...a }` and object rest, class fields (`x = 1`, `#private`), `??=` and `||=`, BigInt.
  - Missing at run time (`undefined`): `Array.prototype.at`, `flat`, `flatMap`, `findLast`, `Object.fromEntries`, `Object.hasOwn`, `String.prototype.replaceAll`, `trimEnd`, `structuredClone`.
- Node accepts all of these, so a module can pass `node --test` and still fail in the game. Task 1 should make `scripts/check.sh` load every logic module in Quickshell as well (a small headless QML file that imports them and exits).

## Notes for the next tasks

- A cached layer is one texture. A long level at a large window scale can exceed the GPU's maximum texture size (often 16384 px): 300 tiles × 24 px × scale 2 is 14,400 px, at 4K twice that. Split the level cache into screen-wide sections.
- Over HDMI (frames copied from the Radeon to the NVIDIA card), full effects dropped frames (p95 27 ms) although the GPU was only 34 % busy; on the internal panel, driven directly by the Radeon, they did not. This looks like the cross-GPU copy rather than the renderer, but it is worth retesting on a single-GPU machine. A frame-rate watcher based on the mean would not notice it.
- Hyprland 0.56 uses Lua dispatchers: `hyprctl dispatch 'hl.dsp.window.fullscreen({ mode = "fullscreen", window = "pid:123" })'`. `run.sh` shows float, resize, center and move.
- `Qt.quit()` from a `ShellRoot` prints a warning and does not quit; `run.sh` kills the process instead.
