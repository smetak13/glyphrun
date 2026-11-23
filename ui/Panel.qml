import QtQuick

Rectangle {
  property var colors
  property color accent: colors.cyan

  color: Qt.alpha(colors.background, 0.92)
  border.color: accent
  border.width: 1.5
}
