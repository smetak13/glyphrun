import QtQuick
import Quickshell.Io
import qs.Commons as Commons
import "../logic/theme.mjs" as ThemeLogic

QtObject {
  id: theme

  property string colorsText: ""
  readonly property var colors: ThemeLogic.gameColors(ThemeLogic.buildPalette(colorsText, {
    foreground: String(Commons.Color.foreground),
    background: String(Commons.Color.background),
    accent: String(Commons.Color.accent),
    urgent: String(Commons.Color.urgent),
    muted: String(Commons.Color.muted),
  }))

  property FileView colorsFile: FileView {
    path: Commons.Color.currentThemePath + "/colors.toml"
    printErrors: false
    onLoaded: theme.colorsText = text()
    onLoadFailed: theme.colorsText = ""
  }

  property FileView themeNameFile: FileView {
    path: Commons.Color.stateHome + "/omarchy/current/theme.name"
    watchChanges: true
    printErrors: false
    onFileChanged: theme.colorsFile.reload()
  }
}
