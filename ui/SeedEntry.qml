import QtQuick

Rectangle {
  id: screen

  property string text: ""
  property string error: ""
  property string clipboard: ""
  property real time: 0
  property var colors

  color: colors.background

  Panel {
    anchors.centerIn: parent
    width: 520
    height: 230
    colors: screen.colors

    Glyph {
      x: 32
      y: 28
      text: "enter seed"
      size: 22
      color: screen.colors.cyan
    }

    Glyph {
      x: 32
      y: 80
      text: "$ ./start --seed " + screen.text + (Math.floor(screen.time * 2) % 2 === 0 ? "_" : " ")
      size: 18
      color: screen.colors.text
    }

    Glyph {
      x: 32
      y: 120
      text: screen.error
      size: 13
      color: screen.colors.hostile
    }

    Glyph {
      x: 32
      y: 150
      visible: screen.clipboard !== ""
      text: "▸ Ctrl+V · paste " + screen.clipboard
      size: 14
      color: screen.colors.cyan
    }

    Glyph {
      x: 32
      y: 190
      text: "Enter · play   Ctrl+V · paste   Esc · back"
      size: 12
      color: screen.colors.muted
    }
  }
}
