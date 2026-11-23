import QtQuick
import "../logic/backdrop.mjs" as BackdropLogic
import "../logic/screen.mjs" as Screen

Item {
  id: strip

  property var glyphs: []
  property real parallax: 0
  property real cameraX: 0
  property real size: 11
  property color color
  property real texelScale: 1

  x: BackdropLogic.backdropOffset(cameraX, parallax)

  Repeater {
    model: 2

    Item {
      required property int index
      x: index * BackdropLogic.BACKDROP_WIDTH
      width: BackdropLogic.BACKDROP_WIDTH
      height: Screen.SCREEN_HEIGHT
      layer.enabled: true
      layer.textureSize: Qt.size(width * strip.texelScale, height * strip.texelScale)

      Repeater {
        model: strip.glyphs

        Glyph {
          required property var modelData
          x: modelData.x
          y: modelData.y
          text: modelData.text
          size: strip.size
          color: strip.color
        }
      }
    }
  }
}
