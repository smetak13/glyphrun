import QtQuick
import "../logic/heroFigure.mjs" as HeroFigureLogic

Item {
  id: figure

  property var parts: []
  property var colors
  property real lean: 0
  property real stretchX: 1
  property real stretchY: 1

  transform: [
    Rotation {
      angle: figure.lean * 180 / Math.PI
    },
    Scale {
      xScale: figure.stretchX
      yScale: figure.stretchY
    }
  ]

  Repeater {
    model: HeroFigureLogic.PART_COUNT

    FigurePart {
      required property int index
      part: index < figure.parts.length ? figure.parts[index] : null
      colors: figure.colors
    }
  }
}
