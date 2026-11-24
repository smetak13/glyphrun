import QtQuick
import "../logic/boss.mjs" as BossLogic
import "../logic/bossFigure.mjs" as BossFigureLogic
import "../logic/enemyFigure.mjs" as EnemyFigureLogic

Item {
  id: bossItem

  property var colors
  readonly property int dropPoolSize: BossLogic.MAX_DROPS
  readonly property int tracePoolSize: BossLogic.MAX_TRACES
  readonly property int bugPoolSize: BossLogic.MAX_BUGS
  readonly property int bugDeathPoolSize: 4
  readonly property int bugPartCount: EnemyFigureLogic.partCount({ kind: "bug" })
  readonly property real blinkRate: 8
  readonly property int sparkleCount: 4
  readonly property real sparkleGap: 14
  readonly property real arrowBob: 4
  readonly property real arrowBobRate: 6
  readonly property real faceLineHeight: 20
  readonly property real trailCell: 8

  visible: false

  function blinkOn(time) {
    return Math.floor(time * blinkRate) % 2 === 0
  }

  function pips(hits) {
    return "[ " + "■".repeat(hits) + "□".repeat(BossLogic.BOSS_HITS - hits) + " ]"
  }

  function box(text, x, y, width, height, role, opacity) {
    return { text: text, measure: text, x: x, y: y, width: width, height: height, rotation: 0, scaleX: 1, role: role, opacity: opacity }
  }

  function syncFace(boss, center, time) {
    const state = BossFigureLogic.faceState(boss.state)
    const layers = BossFigureLogic.faceLayers(state, time)
    faceHostile.text = layers.hostile
    faceShade.text = layers.shade
    faceEyes.text = layers.eyes
    faceGlitch.visible = layers.glitchRow >= 0
    faceGlitch.text = layers.glitch
    faceGlitch.x = layers.glitchShift * faceMetrics.advanceWidth("═")
    faceGlitch.y = layers.glitchRow * faceLineHeight
    face.x = Math.round(center - faceHostile.width / 2)
    face.opacity = boss.state === "reboot" || boss.state === "done" ? 0.35 : state === "dead" ? 0.45 : 1
  }

  function syncDrops(boss, time, animator, fullEffects) {
    for (let i = 0; i < dropPoolSize; i++) {
      const spike = spikes.itemAt(i)
      const trail = trails.itemAt(i)
      const shadow = shadows.itemAt(i)
      const bug = dropBugs.itemAt(i)
      const drop = boss.drops[i]
      const falling = drop !== undefined && drop.warning <= 0
      spike.part = drop && drop.kind === "spike" ? box("^", drop.x, drop.y - BossLogic.SPIKE_SIZE / 2, 0, BossLogic.SPIKE_SIZE, "hostile", drop.warning > 0 ? (blinkOn(time) ? 0.5 : 0.25) : 1) : null
      trail.part = drop && drop.kind === "spike" && falling ? box("┆", drop.x, drop.y - BossLogic.SPIKE_SIZE - 9, 3, 18, "hostileAlt", 0.45) : null
      const look = drop ? BossFigureLogic.dropShadow(drop.warning, BossLogic.DROP_WARNING_SECONDS) : null
      shadow.part = drop ? box(look.text, drop.x, boss.ground - look.height / 2, look.width, look.height, "hostile", look.opacity) : null
      bug.visible = drop !== undefined && drop.kind === "bug"
      if (!bug.visible) continue
      const shape = EnemyFigureLogic.enemyFigure({ kind: "bug", direction: 1, dropping: falling }, animator.time, fullEffects)
      if (!falling) shape.opacity = blinkOn(time) ? 0.5 : 0.25
      bug.shape = shape
      bug.x = Math.round(drop.x)
      bug.y = Math.round(drop.y)
    }
  }

  function syncTraces(boss, time) {
    for (let i = 0; i < tracePoolSize; i++) {
      const item = traces.itemAt(i)
      const trace = boss.traces[i]
      item.visible = trace !== undefined
      if (!trace) continue
      const traceArea = BossLogic.traceBox(boss, trace)
      const moving = trace.warning <= 0
      const centerY = (traceArea.top + traceArea.bottom) / 2
      const faint = moving ? 1 : 0.3
      item.bar = box("████████▓", (traceArea.left + traceArea.right) / 2, centerY, BossLogic.TRACE_LENGTH, BossLogic.TRACE_HEIGHT, "hostileAlt", faint)
      const behind = trace.direction > 0 ? traceArea.left - trailCell : traceArea.right + trailCell
      item.trail = moving ? box(trace.direction > 0 ? "░▒" : "▒░", behind, centerY, 2 * trailCell, BossLogic.TRACE_HEIGHT, "hostileAlt", 0.3) : null
      item.label = BossFigureLogic.traceLabel(trace.text, moving, time)
      item.labelOpacity = faint
      item.labelX = (traceArea.left + traceArea.right) / 2
      item.labelY = traceArea.top
    }
  }

  function syncBugs(boss, animator, fullEffects) {
    for (let i = 0; i < bugPoolSize; i++) {
      const item = bugs.itemAt(i)
      const bug = boss.bugs[i]
      item.visible = bug !== undefined
      if (!bug) continue
      item.shape = EnemyFigureLogic.enemyFigure(bug, animator.time, fullEffects)
      item.x = Math.round(bug.x)
      item.y = Math.round(bug.y)
    }
    const deaths = EnemyFigureLogic.bossDeaths(animator)
    for (let i = 0; i < bugDeathPoolSize; i++) {
      const item = bugDeaths.itemAt(i)
      const death = deaths[i]
      item.visible = death !== undefined
      if (!death) continue
      item.shape = EnemyFigureLogic.deathFigure(death.enemy, animator.time, death.age)
      item.x = Math.round(death.enemy.x)
      item.y = Math.round(death.enemy.y)
    }
  }

  function syncCore(boss, time) {
    core.visible = boss.core !== null && (boss.core.timer > 1 || blinkOn(time))
    coreArrow.visible = core.visible
    const bits = BossFigureLogic.coreBits(time)
    for (let i = 0; i < bits.length; i++) coreBits.itemAt(i).visible = core.visible
    if (!core.visible) return
    core.scale = BossFigureLogic.corePulse(time)
    core.x = Math.round(boss.core.x - core.width / 2)
    core.y = Math.round(boss.ground - core.baselineOffset + 2)
    coreArrow.x = Math.round(boss.core.x - coreArrow.width / 2)
    coreArrow.y = Math.round(core.y - coreArrow.height + Math.sin(time * arrowBobRate) * arrowBob)
    for (let i = 0; i < bits.length; i++) {
      const item = coreBits.itemAt(i)
      item.text = bits[i].text
      item.opacity = bits[i].opacity
      item.x = Math.round(boss.core.x + bits[i].x - item.width / 2)
      item.y = Math.round(boss.ground + bits[i].y - item.height / 2)
    }
  }

  function syncPatch(boss, time) {
    const patchState = boss.patch
    patch.visible = patchState !== null
    patchLabel.visible = patchState !== null && patchState.first
    for (let i = 0; i < sparkleCount; i++) sparkles.itemAt(i).visible = patchState !== null
    if (!patchState) return
    patch.x = Math.round(patchState.x - patch.width / 2)
    patch.y = Math.round(boss.ground - patch.baselineOffset + 2 + BossFigureLogic.patchHop(time))
    patchLabel.x = Math.round(patchState.x - patchLabel.width / 2)
    patchLabel.y = patch.y - patchLabel.height
    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = sparkles.itemAt(i)
      const behind = patch.width / 2 + (i + 0.5) * sparkleGap
      sparkle.x = Math.round(patchState.x - patchState.direction * behind - sparkle.width / 2)
      sparkle.y = Math.round(boss.ground - sparkle.height - 4 + Math.sin(time * 9 + i * 2) * 4)
      sparkle.opacity = (1 - i / sparkleCount) * (blinkOn(time + i * 0.07) ? 0.9 : 0.4)
    }
  }

  function sync(boss, time, animator, fullEffects) {
    visible = boss !== null
    if (!boss) return
    const center = (boss.left + boss.right) / 2
    syncFace(boss, center, time)
    title.x = Math.round(center - title.width / 2)
    title.visible = boss.state !== "intro" || blinkOn(time)
    title.text = boss.state === "reboot" || boss.state === "done" ? "rebooting…" : "KERNEL PANIC"
    hits.text = pips(boss.hits)
    hits.x = Math.round(center - hits.width / 2)
    syncDrops(boss, time, animator, fullEffects)
    syncTraces(boss, time)
    syncBugs(boss, animator, fullEffects)
    syncCore(boss, time)
    syncPatch(boss, time)
  }

  Item {
    id: face
    y: 18
    width: faceHostile.width
    height: faceHostile.height

    FontMetrics {
      id: faceMetrics
      font: faceHostile.font
    }

    Glyph {
      id: faceHostile
      lineHeightMode: Text.FixedHeight
      lineHeight: bossItem.faceLineHeight
      size: 16
      color: bossItem.colors.hostile
    }

    Glyph {
      id: faceShade
      lineHeightMode: Text.FixedHeight
      lineHeight: bossItem.faceLineHeight
      size: 16
      opacity: 0.55
      color: bossItem.colors.hostileAlt
    }

    Glyph {
      id: faceEyes
      lineHeightMode: Text.FixedHeight
      lineHeight: bossItem.faceLineHeight
      size: 16
      color: bossItem.colors.text
    }

    Glyph {
      id: faceGlitch
      visible: false
      lineHeightMode: Text.FixedHeight
      lineHeight: bossItem.faceLineHeight
      size: 16
      color: bossItem.colors.hostileAlt
    }
  }

  Glyph {
    id: title
    y: face.y + face.height + 6
    size: 26
    color: bossItem.colors.hostile
  }

  Glyph {
    id: hits
    y: title.y + title.height + 2
    size: 13
    color: bossItem.colors.muted
  }

  Repeater {
    id: shadows
    model: bossItem.dropPoolSize

    FigurePart {
      colors: bossItem.colors
    }
  }

  Repeater {
    id: trails
    model: bossItem.dropPoolSize

    FigurePart {
      colors: bossItem.colors
    }
  }

  Repeater {
    id: spikes
    model: bossItem.dropPoolSize

    FigurePart {
      colors: bossItem.colors
    }
  }

  Repeater {
    id: dropBugs
    model: bossItem.dropPoolSize

    EnemyFigure {
      visible: false
      count: bossItem.bugPartCount
      colors: bossItem.colors
    }
  }

  Repeater {
    id: traces
    model: bossItem.tracePoolSize

    Item {
      property var bar: null
      property var trail: null
      property alias label: traceText.text
      property alias labelOpacity: traceText.opacity
      property real labelX: 0
      property real labelY: 0
      visible: false

      FigurePart {
        part: parent.trail
        colors: bossItem.colors
      }

      FigurePart {
        part: parent.bar
        colors: bossItem.colors
      }

      Glyph {
        id: traceText
        x: Math.round(parent.labelX - width / 2)
        y: Math.round(parent.labelY - height)
        size: 11
        color: bossItem.colors.hostileAlt
      }
    }
  }

  Repeater {
    id: bugs
    model: bossItem.bugPoolSize

    EnemyFigure {
      visible: false
      count: bossItem.bugPartCount
      colors: bossItem.colors
    }
  }

  Repeater {
    id: bugDeaths
    model: bossItem.bugDeathPoolSize

    EnemyFigure {
      visible: false
      count: bossItem.bugPartCount
      colors: bossItem.colors
    }
  }

  Repeater {
    id: coreBits
    model: 3

    Glyph {
      visible: false
      size: 10
      color: bossItem.colors.bit
    }
  }

  Glyph {
    id: core
    visible: false
    text: "[core]"
    size: 16
    color: bossItem.colors.bit
  }

  Glyph {
    id: coreArrow
    visible: false
    text: "▼"
    size: 16
    color: bossItem.colors.bit
  }

  Repeater {
    id: sparkles
    model: bossItem.sparkleCount

    Glyph {
      visible: false
      text: "+"
      size: 12
      color: bossItem.colors.bit
    }
  }

  Glyph {
    id: patch
    visible: false
    text: "[patch]"
    size: 15
    color: bossItem.colors.bit
  }

  Glyph {
    id: patchLabel
    visible: false
    text: "hotfix"
    size: 11
    opacity: 0.5
    color: bossItem.colors.bit
  }
}
