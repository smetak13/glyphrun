import QtQuick
import "../logic/daily.mjs" as Daily

Rectangle {
  id: screen

  property string day: ""
  property var record: ({ tries: 0, best: null })
  property bool hasOlder: false
  property bool hasNewer: false
  property var colors
  readonly property bool hasResult: record.best !== null

  color: colors.background

  Panel {
    anchors.centerIn: parent
    width: 720
    height: 470
    colors: screen.colors

    Glyph {
      x: 32
      y: 24
      text: "daily high scores"
      size: 22
      color: screen.colors.cyan
    }

    Glyph {
      anchors.horizontalCenter: parent.horizontalCenter
      y: 96
      text: (screen.hasOlder ? "◂  " : "   ") + "daily #" + Daily.dayNumber(screen.day) + " · " + screen.day
        + (screen.hasNewer ? "  ▸" : "   ")
      size: 20
      color: screen.colors.hero
    }

    Column {
      anchors.horizontalCenter: parent.horizontalCenter
      y: 170
      spacing: 16
      visible: screen.hasResult

      Glyph {
        anchors.horizontalCenter: parent.horizontalCenter
        text: screen.hasResult ? Daily.groupDigits(screen.record.best.score) : ""
        size: 40
        color: screen.colors.text
      }

      Glyph {
        anchors.horizontalCenter: parent.horizontalCenter
        text: screen.hasResult ? Daily.resultTime(screen.record.best) + "   " + Daily.triesLabel(screen.record.tries) : ""
        size: 16
        color: screen.colors.muted
      }
    }

    Glyph {
      anchors.horizontalCenter: parent.horizontalCenter
      y: 200
      visible: !screen.hasResult
      text: screen.record.tries > 0 ? "no result yet · " + Daily.triesLabel(screen.record.tries) : "no result yet"
      size: 16
      color: screen.colors.muted
    }

    MenuList {
      anchors.horizontalCenter: parent.horizontalCenter
      y: 320
      width: 240
      visible: screen.hasResult
      items: ["Share"]
      index: 0
      colors: screen.colors
    }

    Glyph {
      x: 32
      y: 440
      text: "←→ · day" + (screen.hasResult ? "   Enter · copy result" : "") + "   Esc · back"
      size: 12
      color: screen.colors.muted
    }
  }
}
