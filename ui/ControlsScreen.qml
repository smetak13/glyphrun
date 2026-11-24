import QtQuick
import "../logic/menu.mjs" as Menu

Rectangle {
  id: screen

  property var colors

  color: colors.background

  Panel {
    anchors.centerIn: parent
    width: 440
    height: 380
    colors: screen.colors

    Glyph {
      x: 32
      y: 28
      text: "controls"
      size: 22
      color: screen.colors.cyan
    }

    Column {
      x: 38
      y: 84
      spacing: 14

      Repeater {
        model: Menu.CONTROLS

        Item {
          required property var modelData
          width: 360
          height: 22

          Glyph {
            text: parent.modelData.keys
            size: 16
            color: screen.colors.hero
          }

          Glyph {
            x: 130
            text: parent.modelData.action
            size: 16
            color: screen.colors.text
          }
        }
      }
    }

    Glyph {
      x: 38
      y: 290
      text: "menus: arrows · enter or space"
      size: 12
      color: screen.colors.muted
    }

    Glyph {
      x: 32
      y: 340
      text: "Esc · back"
      size: 12
      color: screen.colors.muted
    }
  }
}
