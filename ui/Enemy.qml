import QtQuick
import QtQuick.Shapes
import "../logic/enemies.mjs" as Enemies
import "../logic/screen.mjs" as Screen

Item {
  id: enemyItem

  property var enemy
  property var colors
  readonly property var looks: ({
    bug: { text: "ж", size: 26, role: "hostile", drop: 2 },
    zombie: { text: "Z", size: 26, role: "hostileAlt2", drop: 2 },
    spikes: { text: "^", size: 20, role: "hostile", drop: 8 },
    ping: { text: "o", size: 26, role: "hostileAlt", drop: 2 },
    hang: { text: "▼", size: 22, role: "hostileAlt", drop: 2 },
    cron: { text: "[*]", size: 16, role: "hostile", drop: 4 },
    pipe: { text: "}<", size: 36, role: "hostile", drop: 4 },
    pointer: { text: "*", size: 26, role: "hostileAlt", drop: 8 },
    fork: { text: "&", size: enemy.small ? 18 : 26, role: "hostileAlt2", drop: 2 },
    leak: { text: "%", size: 22, role: "hostileAlt2", drop: 2 },
    spinlock: { text: "(o)", size: 18, role: "hostileAlt", drop: 4 },
  })
  readonly property var look: looks[enemy.kind]
  readonly property real walkHop: 2
  readonly property real walkHopRate: 8
  readonly property real blinkRate: 8
  readonly property int shotPoolSize: 4
  readonly property real sourceLeft: enemy.homeX - Screen.TILE / 2
  readonly property real frameHeight: Screen.TILE

  function blinkOn(time) {
    return Math.floor(time * blinkRate) % 2 === 0
  }

  function walks(live) {
    return live.kind === "bug" || live.kind === "fork"
  }

  function syncCron(live) {
    column.visible = Enemies.cronState(live) === "firing"
    column.x = Math.round(live.x - column.width / 2)
    column.y = live.homeY - live.columnTiles * Screen.TILE
  }

  function syncPointer(live, time) {
    body.opacity = Enemies.pointerWarning(live) && !blinkOn(time) ? 0.3 : 1
    for (let i = 0; i < shotPoolSize; i++) {
      const item = shots.itemAt(i)
      item.visible = i < live.shots.length
      if (!item.visible) continue
      item.x = Math.round(live.shots[i])
      item.y = Math.round(live.homeY - Screen.TILE / 2 - item.height / 2)
    }
  }

  function syncPipe(live) {
    daemon.y = Math.round(live.y - daemon.baselineOffset + look.drop - (live.homeY - daemonArea.height))
  }

  function syncLeak(live) {
    puddle.width = Math.round(live.grown)
    puddle.x = Math.round(sourceLeft - live.grown)
  }

  function syncSpinlock(live) {
    for (let i = 0; i < live.links.length; i++) {
      const item = links.itemAt(i)
      const link = live.links[i]
      item.visible = !link.buried
      item.x = Math.round(link.x - item.width / 2)
      item.y = Math.round(link.y - item.height / 2)
    }
  }

  function sync(live, time) {
    visible = live.alive
    if (!live.alive) return
    const hop = walks(live) ? -Math.abs(Math.sin(time * walkHopRate)) * walkHop : 0
    body.x = Math.round(live.x - body.width / 2)
    body.y = Math.round(live.y - body.baselineOffset + look.drop + hop)
    label.x = Math.round(live.x - label.width / 2)
    label.y = body.y - label.height + 6
    thread.x = Math.round(live.x) - 1
    thread.height = Math.max(live.y - live.height, 0)
    if (live.kind === "cron") syncCron(live)
    else if (live.kind === "pointer") syncPointer(live, time)
    else if (live.kind === "pipe") syncPipe(live)
    else if (live.kind === "leak") syncLeak(live)
    else if (live.kind === "spinlock") syncSpinlock(live)
  }

  Rectangle {
    id: thread
    visible: enemyItem.enemy.kind === "hang"
    width: 1.5
    color: enemyItem.colors.muted
  }

  Shape {
    visible: enemyItem.enemy.kind === "leak"
    x: enemyItem.sourceLeft - enemyItem.enemy.extent * Screen.TILE
    y: enemyItem.enemy.homeY - enemyItem.frameHeight
    width: enemyItem.enemy.extent * Screen.TILE
    height: enemyItem.frameHeight

    ShapePath {
      strokeColor: enemyItem.colors.muted
      strokeWidth: 1
      strokeStyle: ShapePath.DashLine
      dashPattern: [2, 3]
      fillColor: "transparent"
      startX: 0
      startY: 0
      PathLine { x: enemyItem.enemy.extent * Screen.TILE; y: 0 }
      PathLine { x: enemyItem.enemy.extent * Screen.TILE; y: enemyItem.frameHeight }
      PathLine { x: 0; y: enemyItem.frameHeight }
      PathLine { x: 0; y: 0 }
    }
  }

  Glyph {
    visible: enemyItem.enemy.kind === "leak"
    x: enemyItem.sourceLeft - enemyItem.enemy.extent * Screen.TILE
    y: enemyItem.enemy.homeY - enemyItem.frameHeight - height
    text: "malloc(" + enemyItem.enemy.extent + ")"
    size: 10
    color: enemyItem.colors.muted
  }

  Item {
    id: puddle
    visible: enemyItem.enemy.kind === "leak"
    y: enemyItem.enemy.homeY - height
    height: Screen.TILE
    clip: true

    Glyph {
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      anchors.bottomMargin: -6
      text: "~".repeat(enemyItem.enemy.extent * 2 + 1)
      size: 20
      color: enemyItem.colors.hostileAlt2
    }
  }

  Glyph {
    id: column
    visible: false
    width: Screen.TILE
    height: enemyItem.enemy.columnTiles * Screen.TILE
    horizontalAlignment: Text.AlignHCenter
    lineHeightMode: Text.FixedHeight
    lineHeight: Screen.TILE
    text: Array(enemyItem.enemy.columnTiles + 1).join("#\n").trim()
    size: 22
    color: enemyItem.colors.hostileAlt
  }

  Repeater {
    id: shots
    model: enemyItem.enemy.kind === "pointer" ? enemyItem.shotPoolSize : 0

    Glyph {
      visible: false
      text: "<--"
      size: 16
      color: enemyItem.colors.hostile
    }
  }

  Repeater {
    id: links
    model: enemyItem.enemy.kind === "spinlock" ? enemyItem.enemy.arm * (enemyItem.enemy.double ? 2 : 1) : 0

    Glyph {
      required property int index
      readonly property bool isTip: index % enemyItem.enemy.arm === enemyItem.enemy.arm - 1
      visible: false
      text: isTip ? "*" : "·"
      size: isTip ? 22 : 20
      color: enemyItem.colors.hostile
    }
  }

  Item {
    id: daemonArea
    visible: enemyItem.enemy.kind === "pipe"
    x: enemyItem.enemy.homeX - width / 2
    y: enemyItem.enemy.homeY - height
    width: 2 * Screen.TILE
    height: 3 * Screen.TILE
    clip: true

    Glyph {
      id: daemon
      anchors.horizontalCenter: parent.horizontalCenter
      text: enemyItem.look.text
      size: enemyItem.look.size
      color: enemyItem.colors[enemyItem.look.role]
    }
  }

  Glyph {
    id: body
    visible: enemyItem.enemy.kind !== "pipe"
    text: enemyItem.enemy.kind === "spikes" ? enemyItem.look.text.repeat(enemyItem.enemy.tiles * 2) : enemyItem.look.text
    size: enemyItem.look.size
    color: enemyItem.colors[enemyItem.look.role]
  }

  Glyph {
    id: label
    visible: enemyItem.enemy.kind === "zombie"
    text: "<defunct>"
    size: 10
    color: enemyItem.colors.hostileAlt2
  }
}
