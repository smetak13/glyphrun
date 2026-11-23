import QtQuick

Column {
  id: list

  property var items: []
  property int index: 0
  property var colors

  spacing: 8

  Repeater {
    model: list.items

    Rectangle {
      required property string modelData
      required property int index
      readonly property bool selected: index === list.index
      width: list.width
      height: 40
      color: selected ? Qt.alpha(list.colors.hero, 0.14) : "transparent"
      border.color: selected ? list.colors.hero : "transparent"
      border.width: 1

      Glyph {
        anchors.verticalCenter: parent.verticalCenter
        x: 14
        text: (parent.selected ? "▸ " : "  ") + parent.modelData
        size: 16
        color: parent.selected ? list.colors.text : list.colors.muted
      }
    }
  }
}
