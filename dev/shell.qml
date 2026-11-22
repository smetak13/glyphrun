import QtQuick
import Quickshell

ShellRoot {
  Glyphrun {
    id: game
    shell: QtObject {
      function hide(pluginId) { Qt.quit() }
    }
    Component.onCompleted: game.open("{}")
  }
}
