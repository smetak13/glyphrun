import QtQuick

Rectangle {
  id: hint

  property var colors
  property string weaponId: ""
  property var weapon: null
  property real pulse: 1
  readonly property color accent: weapon ? colors[weapon.role] : colors.text

  width: Math.max(title.width, line.width) + 56
  height: 66
  color: Qt.alpha(colors.background, 0.9)
  border.color: accent
  border.width: 1

  Row {
    id: title
    anchors.horizontalCenter: parent.horizontalCenter
    y: 10
    spacing: 10

    WeaponIcon {
      anchors.verticalCenter: parent.verticalCenter
      weapon: hint.weaponId
      glyphScale: 1.3
      colors: hint.colors
    }

    Glyph {
      text: hint.weapon ? hint.weapon.name + " acquired" : ""
      size: 18
      color: hint.accent
    }
  }

  Row {
    id: line
    anchors.horizontalCenter: parent.horizontalCenter
    y: 38
    spacing: 6

    Glyph {
      anchors.verticalCenter: parent.verticalCenter
      text: "press"
      size: 14
      color: hint.colors.text
    }

    Rectangle {
      anchors.verticalCenter: parent.verticalCenter
      width: 22
      height: 20
      color: "transparent"
      border.color: hint.accent
      border.width: 1.5

      Glyph {
        anchors.centerIn: parent
        text: "X"
        size: 14
        color: hint.accent
        opacity: hint.pulse
      }
    }

    Glyph {
      anchors.verticalCenter: parent.verticalCenter
      text: hint.weapon ? "to " + hint.weapon.verb : ""
      size: 14
      color: hint.colors.text
    }
  }
}
