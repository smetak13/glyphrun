import QtQuick
import "../logic/screen.mjs" as Screen
import "../logic/level.mjs" as Level
import "../logic/run.mjs" as Run
import "../logic/seed.mjs" as Seed

Item {
  id: view

  property var run
  property var world
  property bool paused: false
  property bool menuOpen: false
  property int menuIndex: 0
  property var menuItems: []
  property var colors
  property real pixelRatio: 1
  readonly property real gameScale: Math.min(width / Screen.SCREEN_WIDTH, height / Screen.SCREEN_HEIGHT)
  readonly property real texelScale: gameScale * pixelRatio
  readonly property var sections: Level.levelSections(world.level)
  property bool checkpointLit: false
  property bool finished: false
  property bool over: false
  property string hudLeft: ""
  property string hudRight: ""
  property string finishedText: ""
  property string overCause: ""
  readonly property real heroBaselineDrop: 2
  readonly property real bigHeroOffset: 20
  readonly property int popupPoolSize: 8
  readonly property real popupRise: 40

  function pad(value, length) {
    return String(value).padStart(length, "0")
  }

  function heroBlinkedOut() {
    return run.dying > 0 || (run.invulnerable > 0 && Math.floor(run.invulnerable * 16) % 2 === 0)
  }

  function syncHero() {
    hero.x = Math.round(world.hero.x - hero.width / 2)
    hero.y = Math.round(world.hero.y - hero.baselineOffset + heroBaselineDrop)
    hero.visible = !heroBlinkedOut()
    heroTop.x = hero.x
    heroTop.y = hero.y - bigHeroOffset
    heroTop.visible = hero.visible && world.hero.big
  }

  function syncMessages() {
    const toast = run.toast
    toastBox.visible = toast !== null
    if (toast) {
      toastText.text = toast.text
      toastText.color = colors[toast.role]
      toastBox.opacity = Math.min(1, (Run.TOAST_SECONDS - toast.age) * 2)
    }
    const shown = run.popups.slice(-popupPoolSize)
    for (let i = 0; i < popupPoolSize; i++) {
      const item = popups.itemAt(i)
      const popup = shown[i]
      item.visible = popup !== undefined
      if (!popup) continue
      item.text = popup.text
      item.note = popup.note
      item.role = popup.role
      item.x = Math.round(popup.x - item.width / 2)
      item.y = Math.round(popup.y - item.height - popup.age * popupRise)
      item.opacity = Math.min(1, (Run.POPUP_SECONDS - popup.age) * 1.5)
    }
  }

  function syncHud() {
    hudLeft = "LVL " + run.levelNumber + "/" + Run.LEVEL_COUNT
    hudRight = "bits " + pad(Run.runBits(run), 3) + "   score " + pad(run.score, 5) + "   " + pad(world.time.toFixed(1), 4) + "s   @ x" + run.lives
  }

  function sync() {
    worldLayer.x = -Math.round(world.cameraX)
    syncHero()
    for (let i = 0; i < bits.count; i++) {
      const item = bits.itemAt(i)
      item.visible = !world.bits[i].collected
      item.y = item.restY + Math.sin(world.time * 3 + item.x) * 3
    }
    for (let i = 0; i < enemies.count; i++) enemies.itemAt(i).sync(world.enemies[i], world.time)
    checkpointLit = world.checkpointReached
    finished = world.finished
    over = run.over
    overCause = run.over ? run.cause + " · level " + run.levelNumber + "/" + Run.LEVEL_COUNT : ""
    finishedText = "time bonus +" + run.timeBonus + "   Space · " + (run.levelNumber < Run.LEVEL_COUNT ? "next level" : "new run")
    syncHud()
    syncMessages()
  }

  Item {
    id: stage
    width: Screen.SCREEN_WIDTH
    height: Screen.SCREEN_HEIGHT
    x: (view.width - width * view.gameScale) / 2
    y: (view.height - height * view.gameScale) / 2
    scale: view.gameScale
    transformOrigin: Item.TopLeft
    clip: true

    Rectangle {
      anchors.fill: parent
      color: view.colors.background
    }

    Item {
      id: worldLayer

      Repeater {
        model: view.sections

        Item {
          required property var modelData
          x: modelData.x
          width: Level.SECTION_WIDTH + Level.SECTION_OVERHANG
          height: Screen.SCREEN_HEIGHT
          layer.enabled: true
          layer.textureSize: Qt.size(width * view.texelScale, height * view.texelScale)

          Repeater {
            model: parent.modelData.glyphs

            Glyph {
              required property var modelData
              x: modelData.x
              y: modelData.y
              text: modelData.text
              size: modelData.size
              color: view.colors[modelData.role]
            }
          }
        }
      }

      Repeater {
        id: bits
        model: view.world.bits

        Glyph {
          required property var modelData
          readonly property real restY: (modelData.row + 0.5) * Screen.TILE - height / 2
          x: (modelData.col + 0.5) * Screen.TILE - width / 2
          y: restY
          text: modelData.text
          size: 20
          color: view.colors.bit
        }
      }

      Repeater {
        model: view.world.level.checkpoint ? Level.checkpointGlyphs(view.world.level.checkpoint, view.checkpointLit) : []

        Glyph {
          required property var modelData
          x: modelData.x
          y: modelData.y
          text: modelData.text
          size: modelData.size
          color: view.colors[modelData.role]
        }
      }

      Repeater {
        id: enemies
        model: view.world.enemies

        Enemy {
          required property var modelData
          enemy: modelData
          colors: view.colors
        }
      }

      Glyph {
        id: heroTop
        text: "@"
        size: 28
        color: view.colors.hero
      }

      Glyph {
        id: hero
        text: "@"
        size: 28
        color: view.colors.hero
      }

      Repeater {
        id: popups
        model: view.popupPoolSize

        Column {
          property alias text: score.text
          property alias note: note.text
          property string role: "bit"
          visible: false

          Glyph {
            id: score
            anchors.horizontalCenter: parent.horizontalCenter
            size: 14
            color: view.colors[parent.role]
          }

          Glyph {
            id: note
            anchors.horizontalCenter: parent.horizontalCenter
            visible: text !== ""
            size: 11
            opacity: 0.75
            color: view.colors[parent.role]
          }
        }
      }
    }

    Rectangle {
      x: 16
      y: 14
      width: hudLevel.width + 16
      height: 26
      color: view.colors.muted
      opacity: 0.35
    }

    Glyph {
      id: hudLevel
      x: 24
      y: 17
      text: view.hudLeft
      size: 14
      color: view.colors.bit
    }

    Glyph {
      x: 118
      y: 17
      text: "seed " + Seed.formatSeed(view.run.seed)
      size: 14
      color: view.colors.text
    }

    Glyph {
      anchors.right: parent.right
      anchors.rightMargin: 20
      y: 17
      text: view.hudRight
      size: 14
      color: view.colors.text
    }

    Rectangle {
      id: toastBox
      z: 1
      anchors.horizontalCenter: parent.horizontalCenter
      y: 64
      width: Math.max(300, toastText.width + 40)
      height: 34
      visible: false
      color: Qt.alpha(view.colors.background, 0.85)

      Glyph {
        id: toastText
        anchors.centerIn: parent
        size: 16
      }
    }

    Column {
      anchors.centerIn: parent
      visible: view.finished
      spacing: 12

      Glyph {
        anchors.horizontalCenter: parent.horizontalCenter
        text: "$ exit 0"
        size: 40
        color: view.colors.cyan
      }

      Glyph {
        anchors.horizontalCenter: parent.horizontalCenter
        text: view.finishedText
        size: 14
        color: view.colors.text
      }
    }

    Column {
      anchors.centerIn: parent
      visible: view.over
      spacing: 12

      Glyph {
        anchors.horizontalCenter: parent.horizontalCenter
        text: "Segmentation fault (core dumped)"
        size: 24
        color: view.colors.hostile
      }

      Glyph {
        anchors.horizontalCenter: parent.horizontalCenter
        text: view.overCause
        size: 14
        color: view.colors.muted
      }

      Glyph {
        anchors.horizontalCenter: parent.horizontalCenter
        text: "Space · retry this seed"
        size: 14
        color: view.colors.muted
      }
    }

    GameMenu {
      anchors.fill: parent
      visible: view.menuOpen
      items: view.menuItems
      index: view.menuIndex
      colors: view.colors
    }

    Rectangle {
      anchors.fill: parent
      visible: view.paused
      color: Qt.rgba(0, 0, 0, 0.6)

      Glyph {
        anchors.centerIn: parent
        text: "[ PAUSED ]"
        size: 28
        color: view.colors.text
      }
    }
  }

  Component.onCompleted: sync()
}
