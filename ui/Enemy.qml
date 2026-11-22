import QtQuick

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
  })
  readonly property var look: looks[enemy.kind]
  readonly property real walkHop: 2
  readonly property real walkHopRate: 8

  function sync(live, time) {
    visible = live.alive
    if (!live.alive) return
    const hop = live.kind === "bug" ? -Math.abs(Math.sin(time * walkHopRate)) * walkHop : 0
    body.x = Math.round(live.x - body.width / 2)
    body.y = Math.round(live.y - body.baselineOffset + look.drop + hop)
    label.x = Math.round(live.x - label.width / 2)
    label.y = body.y - label.height + 6
    thread.x = Math.round(live.x) - 1
    thread.height = Math.max(live.y - live.height, 0)
  }

  Rectangle {
    id: thread
    visible: enemyItem.enemy.kind === "hang"
    width: 1.5
    color: enemyItem.colors.muted
  }

  Glyph {
    id: body
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
