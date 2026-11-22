import QtQuick
import Quickshell
import "scene.mjs" as Scene

Item {
  id: renderer

  property var scene
  property var palette
  property real scaleFactor: 1
  property real pixelRatio: 1
  property bool fullEffects: true
  property var paintTimes: []
  property int paintedFrames: 0
  readonly property string fontFamily: "JetBrainsMono Nerd Font"
  readonly property var levelGlyphs: Scene.buildLevel(7)
  readonly property var hexdump: Scene.buildHexdump(7)
  property string levelUrl: ""
  property string farUrl: ""
  property string nearUrl: ""
  readonly property bool cachesReady: levelUrl !== "" && farUrl !== "" && nearUrl !== ""

  function sync() {
    screen.requestPaint()
  }

  function glyph(ctx, ch, x, y, color, size, glow, baseline) {
    ctx.font = "bold " + size + "px '" + fontFamily + "'"
    ctx.textBaseline = baseline || "top"
    ctx.fillStyle = color
    if (fullEffects && glow > 0) {
      ctx.shadowColor = color
      ctx.shadowBlur = glow * scaleFactor
    }
    ctx.fillText(ch, x, y)
    ctx.shadowBlur = 0
  }

  component Cache: Canvas {
    x: renderer.width + 10
    width: Scene.LEVEL_WIDTH * renderer.scaleFactor
    height: Scene.H * renderer.scaleFactor
    renderStrategy: Canvas.Immediate
    property bool captured: false
    signal capturedUrl(string url)
    onPainted: {
      if (captured) return
      captured = true
      capturedUrl(toDataURL("image/png"))
      visible = false
    }
  }

  Cache {
    id: levelCache
    onCapturedUrl: url => { renderer.levelUrl = url; screen.loadImage(url) }
    onPaint: {
      const ctx = getContext("2d")
      ctx.reset()
      ctx.scale(renderer.scaleFactor, renderer.scaleFactor)
      for (const g of renderer.levelGlyphs) renderer.glyph(ctx, g.ch, g.x, g.y, renderer.palette[g.role], g.size, g.role === "muted" ? 0 : 6)
    }
  }

  Cache {
    id: farCache
    onCapturedUrl: url => { renderer.farUrl = url; screen.loadImage(url) }
    onPaint: {
      const ctx = getContext("2d")
      ctx.reset()
      ctx.scale(renderer.scaleFactor, renderer.scaleFactor)
      for (const h of renderer.hexdump.far) renderer.glyph(ctx, h.text, h.x, h.y, renderer.palette.hexFar, 11, 0)
    }
  }

  Cache {
    id: nearCache
    onCapturedUrl: url => { renderer.nearUrl = url; screen.loadImage(url) }
    onPaint: {
      const ctx = getContext("2d")
      ctx.reset()
      ctx.scale(renderer.scaleFactor, renderer.scaleFactor)
      for (const h of renderer.hexdump.near) renderer.glyph(ctx, h.text, h.x, h.y, renderer.palette.hexNear, 12, 0)
    }
  }

  Canvas {
    id: screen
    anchors.fill: parent
    onPainted: renderer.paintedFrames++
    renderStrategy: ({ immediate: Canvas.Immediate, threaded: Canvas.Threaded, cooperative: Canvas.Cooperative })[Quickshell.env("SPIKE_CANVAS_STRATEGY") || "immediate"]

    function band(ctx, url, offset) {
      const k = renderer.scaleFactor
      const pr = renderer.pixelRatio
      ctx.drawImage(url, Math.max(0, offset) * k * pr, 0, width * pr, height * pr, 0, 0, width / k, height / k)
    }

    onPaint: {
      const started = Date.now()
      const ctx = getContext("2d")
      const s = renderer.scene
      const p = renderer.palette
      const k = renderer.scaleFactor
      ctx.reset()
      ctx.fillStyle = p.backdrop
      ctx.fillRect(0, 0, width, height)
      if (!renderer.cachesReady || !isImageLoaded(renderer.levelUrl)) return
      ctx.scale(k, k)
      const cam = Math.round(s.camX)
      band(ctx, renderer.farUrl, cam * 0.3)
      band(ctx, renderer.nearUrl, cam * 0.6)
      ctx.translate(s.shakeX, s.shakeY)
      band(ctx, renderer.levelUrl, cam)
      ctx.translate(-cam, 0)
      ctx.textAlign = "center"
      for (const m of s.movers) {
        renderer.glyph(ctx, m.ch, m.x, m.y, p[m.role], m.size, 10, "bottom")
        if (m.label) renderer.glyph(ctx, m.label, m.x, m.y - 30, p[m.role], 10, 0, "bottom")
        if (m.motion === "hang") renderer.glyph(ctx, "│", m.x, m.y - 26, p.muted, 20, 0, "bottom")
      }
      renderer.glyph(ctx, "@", s.hero.x, s.hero.y + 2, p.hero, 28, 12, "bottom")
      renderer.glyph(ctx, "@", s.hero.x, s.hero.y - 20, p.hero, 28, 12, "bottom")
      for (const q of s.particles) {
        if (!q.alive) continue
        ctx.globalAlpha = q.opacity
        renderer.glyph(ctx, q.ch, q.x, q.y, p[q.role], 14, 6, "middle")
      }
      ctx.globalAlpha = 1
      renderer.paintTimes.push(Date.now() - started)
    }
  }
}
