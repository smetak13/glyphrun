import QtQuick
import "../logic/story.mjs" as Story

Rectangle {
  id: screen

  property real time: 0
  property var colors

  color: colors.background

  Glyph {
    x: 120
    y: 72
    text: Story.introShown(screen.time) + (Math.floor(screen.time * 3) % 2 === 0 ? "_" : " ")
    lineHeightMode: Text.FixedHeight
    lineHeight: 28
    size: 20
    color: screen.colors.text
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 490
    text: "Space · continue"
    size: 12
    color: screen.colors.muted
  }
}
