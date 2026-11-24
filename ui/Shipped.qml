import QtQuick
import "../logic/story.mjs" as Story

Rectangle {
  id: screen

  property real time: 0
  property int rank: 0
  property var colors
  readonly property bool typed: time >= Story.SHIPPED_TYPED_SECONDS

  color: colors.background

  Glyph {
    x: 80
    y: 120
    text: Story.shippedShown(screen.time) + (!screen.typed && Math.floor(screen.time * 3) % 2 === 0 ? "_" : "")
    lineHeightMode: Text.FixedHeight
    lineHeight: 24
    size: 16
    color: screen.colors.text
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 436
    visible: screen.typed && screen.rank > 0
    text: "fastest run #" + screen.rank
    size: 14
    color: screen.colors.hero
  }

  Glyph {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 470
    text: screen.typed ? "Space · face it" : "Space · skip"
    size: 14
    color: screen.colors.muted
  }
}
