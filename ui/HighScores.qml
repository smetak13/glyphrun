import QtQuick
import "../logic/highScores.mjs" as HighScores
import "../logic/menu.mjs" as Menu
import "../logic/seed.mjs" as Seed

Rectangle {
  id: screen

  property var scores: []
  property var times: []
  property int tab: 0
  property int row: -1
  property int action: 0
  property var colors
  readonly property bool timeTab: Menu.SCORE_TABS[tab] === "time"
  readonly property var entries: timeTab ? times : scores
  readonly property var headers: timeTab ? ["#", "time", "seed", "date"] : ["#", "score", "seed", "level", "date"]
  readonly property var columns: timeTab ? [32, 72, 200, 330] : [32, 72, 180, 310, 400]
  readonly property real actionsX: 540

  color: colors.background

  function cells(entry, index) {
    const place = String(index + 1)
    const seed = Seed.formatSeed(entry.seed)
    if (timeTab) return [place, HighScores.runTime(entry.seconds), seed, entry.date]
    return [place, String(entry.score).padStart(5, "0"), seed, HighScores.stageLabel(entry), entry.date]
  }

  Panel {
    anchors.centerIn: parent
    width: 720
    height: 470
    colors: screen.colors

    Glyph {
      x: 32
      y: 24
      text: "high scores"
      size: 22
      color: screen.colors.cyan
    }

    Row {
      x: 400
      y: 30
      spacing: 16

      Repeater {
        model: Menu.SCORE_TABS

        Glyph {
          required property string modelData
          required property int index
          readonly property bool active: index === screen.tab
          text: active ? "[" + modelData + "]" : " " + modelData + " "
          size: 15
          color: active ? (screen.row < 0 ? screen.colors.hero : screen.colors.text) : screen.colors.muted
        }
      }
    }

    Repeater {
      model: screen.headers

      Glyph {
        required property string modelData
        required property int index
        x: screen.columns[index]
        y: 70
        text: modelData
        size: 13
        color: screen.colors.muted
      }
    }

    Glyph {
      x: 32
      y: 110
      visible: screen.entries.length === 0
      text: screen.timeTab ? "nothing shipped yet. hold shift and go." : "no scores yet. go ship something."
      size: 14
      color: screen.colors.muted
    }

    Repeater {
      model: screen.entries

      Item {
        id: line
        required property var modelData
        required property int index
        readonly property bool selected: index === screen.row
        x: 20
        y: 94 + index * 32
        width: 680
        height: 30

        Rectangle {
          anchors.fill: parent
          color: line.selected ? Qt.alpha(screen.colors.hero, 0.14) : "transparent"
          border.color: line.selected ? screen.colors.hero : "transparent"
          border.width: 1
        }

        Repeater {
          model: screen.cells(line.modelData, line.index)

          Glyph {
            required property string modelData
            required property int index
            x: screen.columns[index] - 20
            anchors.verticalCenter: parent.verticalCenter
            text: modelData
            size: 14
            color: line.selected ? screen.colors.text : screen.colors.muted
          }
        }

        Row {
          x: screen.actionsX - 20
          anchors.verticalCenter: parent.verticalCenter
          spacing: 12
          visible: line.selected

          Repeater {
            model: Menu.SCORE_ACTIONS

            Glyph {
              required property string modelData
              required property int index
              text: index === screen.action ? "[" + modelData + "]" : " " + modelData + " "
              size: 14
              color: index === screen.action ? screen.colors.hero : screen.colors.muted
            }
          }
        }
      }
    }

    Glyph {
      x: 32
      y: 440
      text: screen.row < 0
        ? "←→ · score or time   ↓ · choose a run   Esc · back"
        : "↑↓ · choose   ←→ · play or copy seed   Enter · select   Esc · back"
      size: 12
      color: screen.colors.muted
    }
  }
}
