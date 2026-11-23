import QtQuick
import "../logic/screen.mjs" as Screen

Item {
  id: frame

  default property alias content: stage.data
  readonly property real gameScale: Math.min(width / Screen.SCREEN_WIDTH, height / Screen.SCREEN_HEIGHT)

  Item {
    id: stage
    width: Screen.SCREEN_WIDTH
    height: Screen.SCREEN_HEIGHT
    x: (frame.width - width * frame.gameScale) / 2
    y: (frame.height - height * frame.gameScale) / 2
    scale: frame.gameScale
    transformOrigin: Item.TopLeft
    clip: true
  }
}
