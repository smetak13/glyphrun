import QtQuick
import "../logic/seed.mjs" as Seed
import "../logic/story.mjs" as Story

Rectangle {
  id: over

  property var run
  property string cause: ""
  property int rank: 0
  property var items: []
  property int index: 0
  property var colors

  color: Qt.alpha(colors.background, 0.7)

  Panel {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 60
    width: 500
    height: 380
    colors: over.colors
    accent: over.colors.hostile

    Column {
      x: 28
      y: 24
      spacing: 10

      Glyph {
        text: "Segmentation fault (core dumped)"
        size: 22
        color: over.colors.hostile
      }

      Glyph {
        text: over.cause
        size: 14
        color: over.colors.muted
      }

      Glyph {
        text: "score " + String(over.run.score).padStart(5, "0") + "   seed " + Seed.formatSeed(over.run.seed)
          + (over.rank > 0 ? "   new high score #" + over.rank : "")
        size: 14
        color: over.colors.text
      }
    }

    MenuList {
      x: 24
      y: 150
      width: parent.width - 48
      items: over.items
      index: over.index
      colors: over.colors
    }
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 480
    text: Story.gameOverTip(over.run.seed, over.run.score)
    size: 14
    color: over.colors.muted
  }
}
