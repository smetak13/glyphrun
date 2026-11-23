import QtQuick
import "../logic/run.mjs" as Run
import "../logic/seed.mjs" as Seed
import "../logic/story.mjs" as Story

Rectangle {
  id: screen

  property var run
  property real time: 0
  property int rank: 0
  property var items: []
  property int index: 0
  property var colors
  readonly property var scene: Story.victoryScene(time)
  readonly property var bootLog: Story.bootLog(run.stats, Run.runBits(run), Run.runSeconds(run))
  readonly property var sparks: Story.fireworks(run.seed)
  readonly property real groundY: 440

  color: colors.background

  Column {
    x: 60
    y: 40
    spacing: 4

    Repeater {
      model: screen.bootLog.slice(0, screen.scene.bootLines)

      BootLine {
        required property string modelData
        text: modelData
        colors: screen.colors
      }
    }
  }

  Item {
    anchors.fill: parent
    visible: screen.scene.walking

    Glyph {
      y: screen.groundY
      text: "▀".repeat(64)
      size: 26
      color: screen.colors.ground
    }

    Column {
      x: Story.SIGN_X
      y: screen.groundY - height + 2

      Glyph {
        text: "[ PRODUCTION ]"
        size: 16
        color: screen.colors.cyan
      }

      Glyph {
        x: 12
        text: "│\n│"
        size: 16
        color: screen.colors.cyan
      }
    }

    Repeater {
      model: screen.sparks

      Glyph {
        required property var modelData
        readonly property var at: Story.sparkAt(modelData, screen.time)
        visible: at !== null
        x: at ? at.x : 0
        y: at ? at.y : 0
        opacity: at ? at.opacity : 0
        text: modelData.text
        size: 16
        color: screen.colors.bit
      }
    }

    Glyph {
      x: screen.scene.heroX
      y: screen.groundY - height + 4
      text: "@"
      size: 28
      color: screen.colors.hero
    }

    Rectangle {
      x: Story.SIGN_X + 150
      y: screen.groundY - height - 4
      width: buttonText.width + 20
      height: 30
      visible: screen.scene.button
      color: screen.scene.buttonRecolored ? Qt.alpha(screen.colors.cyan, 0.25) : "transparent"
      border.color: screen.scene.buttonRecolored ? screen.colors.cyan : screen.colors.muted
      border.width: 1.5

      Behavior on color {
        ColorAnimation { duration: 400 }
      }

      Glyph {
        id: buttonText
        anchors.centerIn: parent
        text: "Submit"
        size: 14
        color: screen.scene.buttonRecolored ? screen.colors.cyan : screen.colors.muted
      }
    }
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 250
    visible: screen.scene.buildPassed
    text: Story.BUILD_PASSED
    size: 30
    color: screen.colors.cyan
  }

  Rectangle {
    anchors.fill: parent
    visible: screen.scene.ending
    color: Qt.alpha(screen.colors.background, 0.8)

    Panel {
      anchors.centerIn: parent
      width: 460
      height: 330
      colors: screen.colors

      Column {
        x: 32
        y: 28
        spacing: 10

        Glyph {
          text: Story.CLOSING_LINE
          size: 20
          color: screen.colors.cyan
        }

        Glyph {
          text: "score " + String(screen.run.score).padStart(5, "0") + (screen.rank > 0 ? "   new high score #" + screen.rank : "")
          size: 15
          color: screen.colors.bit
        }

        Glyph {
          text: "seed " + Seed.formatSeed(screen.run.seed)
          size: 14
          color: screen.colors.muted
        }
      }

      MenuList {
        x: 24
        y: 150
        width: parent.width - 48
        items: screen.items
        index: screen.index
        colors: screen.colors
      }
    }
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 505
    visible: !screen.scene.ending
    text: "Space · skip"
    size: 12
    color: screen.colors.muted
  }
}
