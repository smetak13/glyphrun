import QtQuick
import Quickshell

ShellRoot {
  Glyphrun {
    id: game
    devTools: true
    shell: QtObject {
      function hide(pluginId) { Qt.quit() }
    }
    Component.onCompleted: game.open("{}")
  }
}
