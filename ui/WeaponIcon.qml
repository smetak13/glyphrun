import QtQuick
import "../logic/weapons.mjs" as Weapons

Item {
  id: icon

  property string weapon: ""
  property real glyphScale: 1
  property var colors
  readonly property var glyphs: weapon === "" ? [] : Weapons.iconGlyphs(weapon, glyphScale)

  width: weapon === "" ? 0 : 14 * glyphScale
  height: 14 * glyphScale

  Repeater {
    model: icon.glyphs

    Glyph {
      required property var modelData
      text: modelData.text
      size: modelData.size
      color: icon.colors[modelData.role]
      x: Math.round(icon.width / 2 + modelData.x - width / 2)
      y: Math.round(icon.height / 2 + modelData.y - height / 2)
    }
  }
}
