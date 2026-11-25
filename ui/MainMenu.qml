import QtQuick
import "../logic/story.mjs" as Story

Rectangle {
  id: screen

  property var items: []
  property int index: 0
  property var colors

  color: colors.background

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 28
    text: "@ GLYPHRUN"
    size: 56
    color: screen.colors.hero
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 104
    text: Story.TAGLINE
    size: 14
    color: screen.colors.muted
  }

  MenuList {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 140
    width: 320
    items: screen.items
    index: screen.index
    colors: screen.colors
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 488
    text: "↑↓ · choose   Enter · select"
    size: 12
    color: screen.colors.muted
  }
}
