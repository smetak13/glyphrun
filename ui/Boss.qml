import QtQuick
import "../logic/boss.mjs" as BossLogic

Item {
  id: bossItem

  property var colors
  readonly property int dropPoolSize: BossLogic.MAX_DROPS
  readonly property int tracePoolSize: BossLogic.MAX_TRACES
  readonly property int bugPoolSize: BossLogic.MAX_BUGS
  readonly property real blinkRate: 8
  readonly property real walkHop: 2
  readonly property real walkHopRate: 8
  readonly property string angryFace: [
    "╔══════════════════════╗",
    "║    ▀▄          ▄▀    ║",
    "║     ▄██▄    ▄██▄     ║",
    "║     ▀██▀    ▀██▀     ║",
    "║                      ║",
    "║     ▄▀▀▀▀▀▀▀▀▀▀▄     ║",
    "╚══════════════════════╝",
  ].join("\n")
  readonly property string dumpingFace: [
    "╔══════════════════════╗",
    "║                      ║",
    "║      ╲╱      ╲╱      ║",
    "║      ╱╲      ╱╲      ║",
    "║        ▄▀▀▀▀▄        ║",
    "║        ▀▄▄▄▄▀        ║",
    "╚══════════════════════╝",
  ].join("\n")
  readonly property string deadFace: [
    "╔══════════════════════╗",
    "║                      ║",
    "║      ──      ──      ║",
    "║                      ║",
    "║                      ║",
    "║       ────────       ║",
    "╚══════════════════════╝",
  ].join("\n")

  visible: false

  function blinkOn(time) {
    return Math.floor(time * blinkRate) % 2 === 0
  }

  function faceFor(state) {
    if (state === "core") return dumpingFace
    if (state === "crash" || state === "reboot" || state === "done") return deadFace
    return angryFace
  }

  function pips(hits) {
    return "[ " + "■".repeat(hits) + "□".repeat(BossLogic.BOSS_HITS - hits) + " ]"
  }

  function syncDrops(boss, time) {
    for (let i = 0; i < dropPoolSize; i++) {
      const glyph = drops.itemAt(i)
      const shadow = shadows.itemAt(i)
      const drop = boss.drops[i]
      glyph.visible = drop !== undefined
      shadow.visible = drop !== undefined
      if (!drop) continue
      glyph.text = drop.kind === "bug" ? "ж" : "^"
      glyph.x = Math.round(drop.x - glyph.width / 2)
      glyph.y = Math.round(drop.y - glyph.baselineOffset + 4)
      glyph.opacity = drop.warning > 0 ? (blinkOn(time) ? 0.5 : 0.25) : 1
      shadow.x = Math.round(drop.x - shadow.width / 2)
      shadow.y = Math.round(boss.ground - shadow.baselineOffset)
      shadow.opacity = drop.warning > 0 && !blinkOn(time) ? 0.3 : 0.8
    }
  }

  function syncTraces(boss) {
    for (let i = 0; i < tracePoolSize; i++) {
      const item = traces.itemAt(i)
      const trace = boss.traces[i]
      item.visible = trace !== undefined
      if (!trace) continue
      const box = BossLogic.traceBox(boss, trace)
      item.text = trace.text
      item.x = Math.round(box.left)
      item.y = Math.round(box.top)
      item.opacity = trace.warning > 0 ? 0.3 : 1
    }
  }

  function syncBugs(boss, time) {
    const hop = -Math.abs(Math.sin(time * walkHopRate)) * walkHop
    for (let i = 0; i < bugPoolSize; i++) {
      const item = bugs.itemAt(i)
      const bug = boss.bugs[i]
      item.visible = bug !== undefined
      if (!bug) continue
      item.x = Math.round(bug.x - item.width / 2)
      item.y = Math.round(bug.y - item.baselineOffset + 2 + hop)
    }
  }

  function syncCore(boss, time) {
    core.visible = boss.core !== null && (boss.core.timer > 1 || blinkOn(time))
    if (!boss.core) return
    core.x = Math.round(boss.core.x - core.width / 2)
    core.y = Math.round(boss.ground - core.baselineOffset + 2)
  }

  function sync(boss, time) {
    visible = boss !== null
    if (!boss) return
    const center = (boss.left + boss.right) / 2
    face.text = faceFor(boss.state)
    face.x = Math.round(center - face.width / 2)
    face.opacity = boss.state === "reboot" || boss.state === "done" ? 0.35 : 1
    title.x = Math.round(center - title.width / 2)
    title.visible = boss.state !== "intro" || blinkOn(time)
    title.text = boss.state === "reboot" || boss.state === "done" ? "rebooting…" : "KERNEL PANIC"
    hits.text = pips(boss.hits)
    hits.x = Math.round(center - hits.width / 2)
    syncDrops(boss, time)
    syncTraces(boss)
    syncBugs(boss, time)
    syncCore(boss, time)
  }

  Glyph {
    id: face
    y: 18
    lineHeightMode: Text.FixedHeight
    lineHeight: 20
    size: 16
    color: bossItem.colors.hostile
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

    Glyph {
      visible: false
      text: "▁▁"
      size: 16
      color: bossItem.colors.hostile
    }
  }

  Repeater {
    id: drops
    model: bossItem.dropPoolSize

    Glyph {
      visible: false
      size: 24
      color: bossItem.colors.hostile
    }
  }

  Repeater {
    id: traces
    model: bossItem.tracePoolSize

    Rectangle {
      property alias text: traceText.text
      visible: false
      width: BossLogic.TRACE_LENGTH
      height: BossLogic.TRACE_HEIGHT
      color: bossItem.colors.hostileAlt

      Glyph {
        id: traceText
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.top
        size: 11
        color: bossItem.colors.hostileAlt
      }
    }
  }

  Repeater {
    id: bugs
    model: bossItem.bugPoolSize

    Glyph {
      visible: false
      text: "ж"
      size: 26
      color: bossItem.colors.hostile
    }
  }

  Glyph {
    id: core
    visible: false
    text: "[core]"
    size: 16
    color: bossItem.colors.bit
  }
}
