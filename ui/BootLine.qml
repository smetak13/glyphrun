import QtQuick

Row {
  property string text: ""
  property var colors

  Glyph {
    text: "[  "
    size: 15
    color: parent.colors.text
  }

  Glyph {
    text: "OK"
    size: 15
    color: parent.colors.ground
  }

  Glyph {
    text: "  ] " + parent.text.slice(9)
    size: 15
    color: parent.colors.text
  }
}
