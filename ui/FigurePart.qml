import QtQuick

Text {
  id: glyph

  property var part: null
  property var colors
  readonly property rect ink: metrics.tightBoundingRect(part ? part.measure : "")
  readonly property real fit: !part || ink.height <= 0 ? 0 : part.width > 0 ? part.width / ink.width : part.height / ink.height
  readonly property real inkCenterX: ink.x + ink.width / 2
  readonly property real inkCenterY: baselineOffset + ink.y + ink.height / 2

  textFormat: Text.PlainText
  font.family: "JetBrainsMono Nerd Font"
  font.pixelSize: 40
  font.bold: true
  text: part ? part.text : ""
  visible: part !== null && part.text !== "" && part.opacity > 0
  opacity: part ? part.opacity : 0
  color: part && part.role === "heroAccent" ? colors.text : colors.hero
  x: part ? part.x - inkCenterX : 0
  y: part ? part.y - inkCenterY : 0
  transform: [
    Scale {
      origin.x: glyph.inkCenterX
      origin.y: glyph.inkCenterY
      xScale: glyph.fit * (glyph.part ? glyph.part.scaleX : 1)
      yScale: glyph.fit
    },
    Rotation {
      origin.x: glyph.inkCenterX
      origin.y: glyph.inkCenterY
      angle: glyph.part ? glyph.part.rotation * 180 / Math.PI : 0
    }
  ]

  FontMetrics {
    id: metrics
    font: glyph.font
  }
}
