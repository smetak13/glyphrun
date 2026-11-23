import QtQuick

Rectangle {
  id: menu

  property var items: []
  property int index: 0
  property var colors

  color: Qt.alpha(colors.background, 0.7)

  Panel {
    anchors.centerIn: parent
    width: 360
    height: list.height + 48
    colors: menu.colors

    MenuList {
      id: list
      anchors.centerIn: parent
      width: parent.width - 48
      items: menu.items
      index: menu.index
      colors: menu.colors
    }
  }
}
