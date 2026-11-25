import QtQuick
import "../logic/daily.mjs" as Daily

Rectangle {
  id: screen

  property string today: ""
  property string timeLeft: ""
  property int streak: 0
  property var items: []
  property int index: 0
  property var colors

  color: colors.background

  Glyph {
    x: 32
    y: 28
    text: screen.today + " · " + screen.timeLeft
    size: 15
    color: screen.colors.muted
  }

  Row {
    anchors.right: parent.right
    anchors.rightMargin: 32
    y: 22
    spacing: 10

    Glyph {
      anchors.verticalCenter: parent.verticalCenter
      text: Daily.STREAK_GLYPH
      size: 26
      color: screen.streak > 0 ? screen.colors.bit : screen.colors.muted
    }

    Glyph {
      anchors.verticalCenter: parent.verticalCenter
      text: String(screen.streak)
      size: 22
      color: screen.streak > 0 ? screen.colors.text : screen.colors.muted
    }
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 110
    text: "daily #" + Daily.dayNumber(screen.today)
    size: 44
    color: screen.colors.hero
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 176
    text: "same level for everyone, a new one every day"
    size: 12
    color: screen.colors.muted
  }

  MenuList {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 230
    width: 320
    items: screen.items
    index: screen.index
    colors: screen.colors
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 488
    text: "↑↓ · choose   Enter · select   Esc · back"
    size: 12
    color: screen.colors.muted
  }
}
