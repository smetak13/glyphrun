import QtQuick

Item {
  id: figure

  property var shape: null
  property int count: 0
  property var colors

  opacity: shape ? shape.opacity : 0

  transform: [
    Scale {
      xScale: figure.shape ? figure.shape.scaleX : 1
      yScale: figure.shape ? figure.shape.scaleY : 1
    },
    Rotation {
      origin.y: figure.shape ? figure.shape.pivotY : 0
      angle: figure.shape ? figure.shape.rotation * 180 / Math.PI : 0
    },
    Translate {
      y: figure.shape ? -figure.shape.rise : 0
    }
  ]

  Repeater {
    model: figure.count

    FigurePart {
      required property int index
      part: figure.shape && index < figure.shape.parts.length ? figure.shape.parts[index] : null
      colors: figure.colors
    }
  }
}
