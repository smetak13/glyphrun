import QtQuick

Rectangle {
  id: menu

  property var items: []
  property int index: 0
  property var colors

  color: Qt.alpha(colors.background, 0.7)

  Rectangle {
    anchors.centerIn: parent
    width: 360
    height: list.height + 48
    color: Qt.alpha(menu.colors.background, 0.92)
    border.color: menu.colors.cyan
    border.width: 1.5

    Column {
      id: list
      anchors.centerIn: parent
      width: parent.width - 48
      spacing: 8

      Repeater {
        model: menu.items

        Rectangle {
          required property string modelData
          required property int index
          readonly property bool selected: index === menu.index
          width: list.width
          height: 40
          color: selected ? Qt.alpha(menu.colors.hero, 0.14) : "transparent"
          border.color: selected ? menu.colors.hero : "transparent"
          border.width: 1

          Glyph {
            anchors.verticalCenter: parent.verticalCenter
            x: 14
            text: (parent.selected ? "▸ " : "  ") + parent.modelData
            size: 16
            color: parent.selected ? menu.colors.text : menu.colors.muted
          }
        }
      }
    }
  }
}
