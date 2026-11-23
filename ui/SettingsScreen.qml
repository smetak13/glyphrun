import QtQuick

Rectangle {
  id: screen

  property var items: []
  property int index: 0
  property var colors

  color: colors.background

  Panel {
    anchors.centerIn: parent
    width: 440
    height: 240
    colors: screen.colors

    Glyph {
      x: 32
      y: 28
      text: "settings"
      size: 22
      color: screen.colors.cyan
    }

    MenuList {
      x: 24
      y: 76
      width: parent.width - 48
      items: screen.items
      index: screen.index
      colors: screen.colors
    }

    Glyph {
      x: 32
      y: 140
      text: "reduced turns off glow, glitch and CRT"
      size: 12
      color: screen.colors.muted
    }

    Glyph {
      x: 32
      y: 200
      text: "Enter · change   Esc · back"
      size: 12
      color: screen.colors.muted
    }
  }
}
