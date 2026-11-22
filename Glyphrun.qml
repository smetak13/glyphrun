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
  readonly property var level: Level.parseLevel(TestLevel.TEST_LEVEL)
  property var world: World.createWorld(level)
  property var clock: Clock.createClock()
  property bool leftHeld: false
  property bool rightHeld: false
  property bool jumpHeld: false
  property bool jumpPressed: false
  property bool paused: false

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
    else if (key === Qt.Key_Space || key === Qt.Key_Up) {
      if (held && !jumpHeld) jumpPressed = true
      jumpHeld = held
    } else return false
    return true
  }

  function releaseKeys() {
    leftHeld = false
    rightHeld = false
    jumpHeld = false
    jumpPressed = false
  }

  function restartLevel() {
    world = World.createWorld(level)
    clock = Clock.createClock()
    gameView.sync()
  }

  function frame(frameTime) {
    if (paused) return
    if (world.finished) {
      if (jumpPressed) restartLevel()
      jumpPressed = false
      return
    }
    const steps = Clock.stepsFor(clock, frameTime)
    for (let i = 0; i < steps; i++) {
      const input = { direction: (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0), jumpHeld: jumpHeld, jumpPressed: jumpPressed }
      World.stepWorld(world, input, Clock.STEP_SECONDS)
      jumpPressed = false
    }
    gameView.sync()
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
      root.releaseKeys()
      if (!root.closingFromHost && root.shell) root.shell.hide(root.pluginId)
    }

    FocusScope {
      id: keyCatcher
      anchors.fill: parent
      focus: true

      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_P) {
          if (!event.isAutoRepeat) root.paused = !root.paused
          event.accepted = true
        } else if (!event.isAutoRepeat) event.accepted = root.setHeld(event.key, true)
      }
      Keys.onReleased: function(event) {
        if (!event.isAutoRepeat) event.accepted = root.setHeld(event.key, false)
      }

      GameView {
        id: gameView
        anchors.fill: parent
        world: root.world
        paused: root.paused
        colors: theme.colors
        pixelRatio: window.devicePixelRatio
      }
    }

    FrameAnimation {
      running: window.visible
      onTriggered: root.frame(frameTime)
    }
  }
}
