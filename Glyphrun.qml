import QtQuick
import Quickshell
import "ui"
import "logic/clock.mjs" as Clock
import "logic/level.mjs" as Level
import "logic/testLevel.mjs" as TestLevel
import "logic/world.mjs" as World

Item {
  id: root

  property var shell: null
  readonly property string pluginId: "smetak13.glyphrun"
  readonly property bool opened: window.visible
  property bool closingFromHost: false
  property var world: World.createWorld(Level.parseLevel(TestLevel.TEST_LEVEL))
  property var clock: Clock.createClock()
  property bool leftHeld: false
  property bool rightHeld: false

  function open(payloadJson) {
    window.visible = true
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    closingFromHost = true
    window.visible = false
    closingFromHost = false
  }

  function setHeld(key, held) {
    if (key === Qt.Key_Left) leftHeld = held
    else if (key === Qt.Key_Right) rightHeld = held
    else return false
    return true
  }

  Theme {
    id: theme
  }

  FloatingWindow {
    id: window
    title: "Glyphrun"
    visible: false
    color: Qt.darker(theme.colors.background, 1.4)
    implicitWidth: 960
    implicitHeight: 540

    onVisibleChanged: {
      if (visible) return
      root.leftHeld = false
      root.rightHeld = false
      if (!root.closingFromHost && root.shell) root.shell.hide(root.pluginId)
    }

    FocusScope {
      id: keyCatcher
      anchors.fill: parent
      focus: true

      Keys.onPressed: function(event) {
        if (!event.isAutoRepeat) event.accepted = root.setHeld(event.key, true)
      }
      Keys.onReleased: function(event) {
        if (!event.isAutoRepeat) event.accepted = root.setHeld(event.key, false)
      }

      GameView {
        id: gameView
        anchors.fill: parent
        world: root.world
        colors: theme.colors
        pixelRatio: window.devicePixelRatio
      }
    }

    FrameAnimation {
      running: window.visible
      onTriggered: {
        const input = { direction: (root.rightHeld ? 1 : 0) - (root.leftHeld ? 1 : 0) }
        const steps = Clock.stepsFor(root.clock, frameTime)
        for (let i = 0; i < steps; i++) World.stepWorld(root.world, input, Clock.STEP_SECONDS)
        gameView.sync()
      }
    }
  }
}
