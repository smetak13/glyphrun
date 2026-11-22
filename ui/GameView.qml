import QtQuick
import "../logic/screen.mjs" as Screen
import "../logic/level.mjs" as Level

Item {
  id: view

  property var world
  property bool paused: false
  property var colors
  property real pixelRatio: 1
  readonly property real gameScale: Math.min(width / Screen.SCREEN_WIDTH, height / Screen.SCREEN_HEIGHT)
  readonly property real texelScale: gameScale * pixelRatio
  readonly property var sections: Level.levelSections(world.level)
  property bool checkpointLit: false
  property bool finished: false
  readonly property real heroBaselineDrop: 2

  function sync() {
    worldLayer.x = -Math.round(world.cameraX)
    hero.x = Math.round(world.hero.x - hero.width / 2)
    hero.y = Math.round(world.hero.y - hero.baselineOffset + heroBaselineDrop)
    for (let i = 0; i < bits.count; i++) {
      const item = bits.itemAt(i)
      item.visible = !world.bits[i].collected
      item.y = item.restY + Math.sin(world.time * 3 + item.x) * 3
    }
    checkpointLit = world.checkpointReached
    finished = world.finished
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

      Glyph {
        id: hero
        text: "@"
        size: 28
        color: view.colors.hero
      }
    }

    Glyph {
      anchors.centerIn: parent
      visible: view.finished
      text: "$ exit 0"
      size: 40
      color: view.colors.cyan
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
