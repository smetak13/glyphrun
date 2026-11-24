import QtQuick

Text {
  id: glyph

  property var part: null
  property var colors
  readonly property string measure: part ? part.measure : ""
  readonly property rect ink: metrics.tightBoundingRect(measure)
  readonly property real widthFit: !part || ink.width <= 0 ? 0 : part.width / ink.width
  readonly property real heightFit: !part || ink.height <= 0 ? 0 : part.height / ink.height
  readonly property real fitX: !part ? 0 : part.width > 0 ? widthFit : heightFit
  readonly property real fitY: !part ? 0 : part.height > 0 ? heightFit : widthFit
  readonly property real inkCenterX: ink.x + ink.width / 2
  readonly property real inkCenterY: baselineOffset + ink.y + ink.height / 2

  textFormat: Text.PlainText
  font.family: "JetBrainsMono Nerd Font"
  font.pixelSize: 40
  font.bold: true
  text: part ? part.text : ""
  visible: part !== null && part.text !== "" && part.opacity > 0
  opacity: part ? part.opacity : 0
  color: !part || part.role === "hero" ? colors.hero : part.role === "heroAccent" ? colors.text : colors[part.role]
  x: part ? part.x - inkCenterX : 0
  y: part ? part.y - inkCenterY : 0
  transform: [
    Scale {
      origin.x: glyph.inkCenterX
      origin.y: glyph.inkCenterY
      xScale: glyph.fitX * (glyph.part ? glyph.part.scaleX : 1)
      yScale: glyph.fitY
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
