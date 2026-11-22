import QtQuick

Item {
  id: hud

  property real scaleFactor: 1
  property var palette
  property real time: 0
  readonly property string fontFamily: "JetBrainsMono Nerd Font"

  Rectangle {
    x: 16 * hud.scaleFactor
    y: 14 * hud.scaleFactor
    width: 86 * hud.scaleFactor
    height: 26 * hud.scaleFactor
    color: hud.palette.surface
  }

  Text {
    x: 24 * hud.scaleFactor
    y: 19 * hud.scaleFactor
    text: "LVL 1/5"
    color: hud.palette.hero
    font { family: hud.fontFamily; pixelSize: 14 * hud.scaleFactor; bold: true }
  }

  Text {
    x: 118 * hud.scaleFactor
    y: 19 * hud.scaleFactor
    text: "seed 7f3a-91c2"
    color: hud.palette.foreground
    font { family: hud.fontFamily; pixelSize: 14 * hud.scaleFactor; bold: true }
  }

  Text {
    anchors.right: parent.right
    anchors.rightMargin: 20 * hud.scaleFactor
    y: 19 * hud.scaleFactor
    text: "bits 012   score 00130   " + hud.time.toFixed(1).padStart(4, "0") + "s   @ x3"
    color: hud.palette.foreground
    font { family: hud.fontFamily; pixelSize: 14 * hud.scaleFactor; bold: true }
  }
}
