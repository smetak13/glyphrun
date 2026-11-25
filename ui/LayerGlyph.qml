import QtQuick

Glyph {
  id: glyph

  required property var modelData
  property var colors
  property real cellScaleX: 1
  property real cellScaleY: 1

  x: modelData.x
  y: modelData.y
  text: modelData.text
  size: modelData.size
  color: colors[modelData.role]
  opacity: modelData.opacity
  transform: Scale {
    xScale: glyph.modelData.cell ? glyph.cellScaleX : 1
    yScale: glyph.modelData.cell ? glyph.cellScaleY : 1
  }
}
