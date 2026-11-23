import QtQuick
import "../logic/highScores.mjs" as HighScores
import "../logic/menu.mjs" as Menu
import "../logic/seed.mjs" as Seed

Rectangle {
  id: screen

  property var scores: []
  property int row: 0
  property int action: 0
  property var colors
  readonly property var columns: [32, 72, 180, 310, 400, 540]

  color: colors.background

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

    Repeater {
      model: ["#", "score", "seed", "level", "date"]

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
      visible: screen.scores.length === 0
      text: "no scores yet. go ship something."
      size: 14
      color: screen.colors.muted
    }

    Repeater {
      model: screen.scores

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
          model: [
            String(line.index + 1),
            String(line.modelData.score).padStart(5, "0"),
            Seed.formatSeed(line.modelData.seed),
            HighScores.stageLabel(line.modelData),
            line.modelData.date,
          ]

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
          x: screen.columns[5] - 20
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
      text: "↑↓ · choose   ←→ · play or copy seed   Enter · select   Esc · back"
      size: 12
      color: screen.colors.muted
    }
  }
}
