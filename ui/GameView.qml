import QtQuick
import "../logic/screen.mjs" as Screen
import "../logic/level.mjs" as Level

Item {
  id: view

  property var world
  property var colors
  property real pixelRatio: 1
  readonly property real gameScale: Math.min(width / Screen.SCREEN_WIDTH, height / Screen.SCREEN_HEIGHT)
  readonly property real texelScale: gameScale * pixelRatio
  readonly property var sections: Level.levelSections(world.level)

  function sync() {
    worldLayer.x = -Math.round(world.cameraX)
    hero.x = world.hero.x - hero.width / 2
    hero.y = world.hero.y - hero.height
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

      Glyph {
        id: hero
        text: "@"
        size: 28
        color: view.colors.hero
      }
    }
  }

  Component.onCompleted: sync()
}
