import QtQuick
import "../logic/backdrop.mjs" as BackdropLogic
import "../logic/screen.mjs" as Screen

Item {
  id: strip

  property var glyphs: []
  property real parallax: 0
  property real cameraX: 0
  property var colors
  property real cellScaleX: 1
  property real cellScaleY: 1
  property real texelScale: 1

  x: BackdropLogic.backdropOffset(cameraX, parallax)

  Repeater {
    model: 2

    Item {
      required property int index
      x: index * BackdropLogic.BACKDROP_WIDTH
      width: BackdropLogic.BACKDROP_WIDTH
      height: Screen.SCREEN_HEIGHT
      clip: true
      layer.enabled: true
      layer.textureSize: Qt.size(width * strip.texelScale, height * strip.texelScale)

      Repeater {
        model: strip.glyphs

        LayerGlyph {
          colors: strip.colors
          cellScaleX: strip.cellScaleX
          cellScaleY: strip.cellScaleY
        }
      }
    }
  }
}
