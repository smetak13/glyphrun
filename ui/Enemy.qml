import QtQuick
import QtQuick.Shapes
import "../logic/enemyFigure.mjs" as EnemyFigureLogic
import "../logic/enemies.mjs" as Enemies
import "../logic/screen.mjs" as Screen

Item {
  id: enemyItem

  property var enemy
  property var colors
  readonly property int shotPoolSize: 4
  readonly property int sparkCount: 6
  readonly property real sourceLeft: enemy.homeX - Screen.TILE / 2
  readonly property real frameHeight: Screen.TILE
  readonly property real extentWidth: enemy.extent * Screen.TILE
  readonly property real labelRise: 30
  readonly property real pauseMarkRise: 12
  property real frozenTime: -1

  function syncShots(live, time) {
    for (let i = 0; i < shotPoolSize; i++) {
      const shot = live.shots[i]
      const parts = shot === undefined ? null : EnemyFigureLogic.tinted(EnemyFigureLogic.shotParts(shot, live.homeY - Screen.TILE / 2, time), live)
      shotParts.itemAt(2 * i).part = parts ? parts[0] : null
      shotParts.itemAt(2 * i + 1).part = parts ? parts[1] : null
    }
  }

  function syncSparks(shown, death) {
    const sparks = death ? EnemyFigureLogic.deathSparks(death.enemy, death.age) : []
    for (let i = 0; i < sparkItems.count; i++) {
      const item = sparkItems.itemAt(i)
      const spark = sparks[i]
      item.visible = spark !== undefined
      if (!spark) continue
      item.text = spark.text
      item.color = colors[spark.role]
      item.opacity = spark.opacity
      item.x = Math.round(shown.x + spark.x - item.width / 2)
      item.y = Math.round(shown.y + spark.y - item.height / 2)
    }
  }

  function sync(live, animator, fullEffects) {
    const death = live.alive ? null : EnemyFigureLogic.deathOf(animator, live.id)
    const shown = live.alive ? live : death ? death.enemy : null
    visible = shown !== null
    if (!shown) return
    if (!(live.paused > 0)) frozenTime = -1
    else if (frozenTime < 0) frozenTime = animator.time
    const time = live.paused > 0 ? frozenTime : animator.time
    pauseMark.visible = live.alive && EnemyFigureLogic.pausedLook(live)
    pauseMark.x = Math.round(shown.x - pauseMark.width / 2)
    pauseMark.y = Math.round(shown.y - shown.height - pauseMarkRise - pauseMark.height / 2)
    const shape = live.alive ? EnemyFigureLogic.enemyFigure(live, time, fullEffects) : EnemyFigureLogic.deathFigure(death.enemy, time, death.age)
    figure.shape = shape
    if (live.kind === "pipe") {
      figure.x = daemonArea.width / 2
      figure.y = Math.round(shown.y - (shown.homeY - daemonArea.height))
    } else {
      figure.x = Math.round(shown.x)
      figure.y = Math.round(shown.y)
    }
    label.x = Math.round(shown.x - label.width / 2)
    label.y = Math.round(shown.y - labelRise - shape.rise - label.height / 2)
    label.opacity = shape.opacity
    thread.visible = live.kind === "hang" && live.alive
    thread.x = Math.round(shown.x) - 1
    thread.height = Math.max(shown.y - shown.height, 0)
    syncSparks(shown, death)
    if (live.kind === "cron") {
      column.visible = live.alive && Enemies.cronState(live) === "firing"
      column.shape = column.visible ? { parts: EnemyFigureLogic.tinted(EnemyFigureLogic.columnParts(live, time), live), scaleX: 1, scaleY: 1, rotation: 0, pivotY: 0, opacity: 1, rise: 0 } : null
    } else if (live.kind === "pointer") syncShots(live, time)
    else if (live.kind === "leak") {
      const grown = EnemyFigureLogic.puddleShown(shown, death ? death.age : null)
      puddle.width = Math.round(grown)
      puddle.x = Math.round(extentWidth - grown)
      puddleFigure.shape = { parts: EnemyFigureLogic.tinted(EnemyFigureLogic.puddleParts(live.extent, time), live), scaleX: 1, scaleY: 1, rotation: 0, pivotY: 0, opacity: death ? 1 - death.age / EnemyFigureLogic.DEATH_SECONDS : 1, rise: 0 }
    }
  }

  Rectangle {
    id: thread
    visible: false
    width: 1.5
    color: enemyItem.colors.muted
  }

  Item {
    visible: enemyItem.enemy.kind === "leak"
    x: enemyItem.sourceLeft - enemyItem.extentWidth
    y: enemyItem.enemy.homeY - enemyItem.frameHeight
    width: enemyItem.extentWidth
    height: enemyItem.frameHeight

    Shape {
      anchors.fill: parent

      ShapePath {
        strokeColor: enemyItem.colors.muted
        strokeWidth: 1
        strokeStyle: ShapePath.DashLine
        dashPattern: [2, 3]
        fillColor: "transparent"
        startX: 0
        startY: 0
        PathLine { x: enemyItem.extentWidth; y: 0 }
        PathLine { x: enemyItem.extentWidth; y: enemyItem.frameHeight }
        PathLine { x: 0; y: enemyItem.frameHeight }
        PathLine { x: 0; y: 0 }
      }
    }

    Glyph {
      y: -height
      text: "malloc(" + enemyItem.enemy.extent + ")"
      size: 10
      color: enemyItem.colors.muted
    }

    Item {
      id: puddle
      height: parent.height
      clip: true

      EnemyFigure {
        id: puddleFigure
        x: enemyItem.extentWidth / 2 - puddle.x
        y: enemyItem.frameHeight
        count: 2
        colors: enemyItem.colors
      }
    }
  }

  EnemyFigure {
    id: column
    visible: false
    x: enemyItem.enemy.homeX
    y: enemyItem.enemy.homeY
    count: enemyItem.enemy.kind === "cron" ? EnemyFigureLogic.columnRows(enemyItem.enemy) : 0
    colors: enemyItem.colors
  }

  Repeater {
    id: shotParts
    model: enemyItem.enemy.kind === "pointer" ? 2 * enemyItem.shotPoolSize : 0

    FigurePart {
      colors: enemyItem.colors
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
  }

  EnemyFigure {
    id: figure
    parent: enemyItem.enemy.kind === "pipe" ? daemonArea : enemyItem
    count: EnemyFigureLogic.partCount(enemyItem.enemy)
    colors: enemyItem.colors
  }

  Repeater {
    id: sparkItems
    model: Enemies.stompable(enemyItem.enemy) ? enemyItem.sparkCount : 0

    Glyph {
      visible: false
      size: 10
    }
  }

  Glyph {
    id: pauseMark
    visible: false
    text: "‖"
    size: 12
    color: enemyItem.colors.cyan
  }

  Glyph {
    id: label
    visible: enemyItem.enemy.kind === "zombie"
    text: "<defunct>"
    size: 10
    color: enemyItem.colors.hostileAlt2
  }
}
