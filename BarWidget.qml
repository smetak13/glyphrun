import QtQuick
import qs.Ui

BarWidget {
  id: root

  moduleName: "smetak13.glyphrun"

  readonly property bool gameOpen: bar && bar.shell
    ? bar.shell.openPanelIds[moduleName] === true
    : false

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    active: root.gameOpen
    tooltipText: "Glyphrun"
    text: "@"

    onPressed: function(mouseButton) {
      if (mouseButton !== Qt.LeftButton || !root.bar || !root.bar.shell) return
      root.bar.shell.toggle(root.moduleName, "{}")
    }
  }
}
