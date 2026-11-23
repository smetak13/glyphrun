import QtQuick
import "../logic/run.mjs" as Run
import "../logic/story.mjs" as Story

Item {
  id: summary

  property var run
  property real time: 0
  property bool ready: false
  property var colors
  readonly property var rows: Run.levelSummary(run)
  readonly property string message: Story.commitMessage(run.seed, run.levelNumber)
  readonly property real rowSeconds: 0.3

  Panel {
    anchors.centerIn: parent
    width: 500
    height: 360
    colors: summary.colors

    Glyph {
      x: 28
      y: 24
      text: "$ git commit -am \"" + summary.message + "\""
      size: 15
      color: summary.colors.text
    }

    Glyph {
      x: 28
      y: 50
      text: "[main " + Story.commitHash(summary.run.seed, summary.run.levelNumber) + "] " + summary.message
      size: 15
      color: summary.colors.muted
    }

    Glyph {
      x: 28
      y: 76
      text: " level " + summary.run.levelNumber + "/" + Run.LEVEL_COUNT + " · " + Story.LEVELS[summary.run.levelNumber - 1].title + " · exit 0"
      size: 15
      color: summary.colors.cyan
    }

    Repeater {
      model: summary.rows

      Item {
        required property var modelData
        required property int index
        x: 28
        y: 124 + index * 34
        width: 444
        visible: summary.time > (index + 1) * summary.rowSeconds

        Glyph {
          text: parent.modelData.label
          size: 16
          color: summary.colors.muted
        }

        Glyph {
          x: 110
          text: parent.modelData.detail
          size: 16
          color: summary.colors.text
        }

        Glyph {
          anchors.right: parent.right
          text: "+" + parent.modelData.points
          size: 16
          color: summary.colors.bit
        }
      }
    }

    Item {
      x: 28
      y: 270
      width: 444
      visible: summary.time > (summary.rows.length + 1) * summary.rowSeconds

      Glyph {
        text: "run score"
        size: 18
        color: summary.colors.text
      }

      Glyph {
        anchors.right: parent.right
        text: String(summary.run.score).padStart(5, "0")
        size: 20
        color: summary.colors.bit
      }
    }

    Glyph {
      x: 28
      y: 320
      visible: summary.ready
      text: summary.run.levelNumber < Run.LEVEL_COUNT ? "Space · next level" : "Space · ship it"
      size: 14
      color: summary.colors.cyan
    }
  }
}
