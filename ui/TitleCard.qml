import QtQuick
import "../logic/run.mjs" as Run
import "../logic/story.mjs" as Story

Rectangle {
  id: screen

  property int levelNumber: 1
  property real time: 0
  property var colors
  readonly property var level: Story.LEVELS[Math.min(levelNumber, Run.LEVEL_COUNT) - 1]

  color: colors.background

  Column {
    anchors.centerIn: parent
    spacing: 18
    opacity: Math.min(1, screen.time * 3, (Story.TITLE_SECONDS - screen.time) * 3)

    Glyph {
      anchors.horizontalCenter: parent.horizontalCenter
      text: "level " + screen.levelNumber + "/" + Run.LEVEL_COUNT
      size: 16
      color: screen.colors.muted
    }

    Glyph {
      anchors.horizontalCenter: parent.horizontalCenter
      text: "$ " + screen.level.title
      size: 48
      color: screen.colors.hero
    }

    Glyph {
      anchors.horizontalCenter: parent.horizontalCenter
      text: screen.level.subtitle
      size: 18
      font.italic: true
      color: screen.colors.text
    }
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 440
    text: Story.stepLine(screen.levelNumber)
    size: 12
    color: screen.colors.muted
    opacity: 0.7 * Math.min(1, screen.time * 3, (Story.TITLE_SECONDS - screen.time) * 3)
  }
}
