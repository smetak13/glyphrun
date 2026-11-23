import QtQuick
import Quickshell
import "ui"
import "logic/clock.mjs" as Clock
import "logic/messages.mjs" as Messages
import "logic/run.mjs" as Run
import "logic/seed.mjs" as Seed
import "logic/validator.mjs" as Validator

Item {
  id: root

  property var shell: null
  readonly property string pluginId: "smetak13.glyphrun"
  readonly property bool opened: window.visible
  property bool closingFromHost: false
  property bool devTools: false
  property var run: startingRun(newSeed())
  property var world: run.world
  property var clock: Clock.createClock()
  property bool leftHeld: false
  property bool rightHeld: false
  property bool jumpHeld: false
  property bool jumpPressed: false
  property bool paused: false
  property bool menuOpen: false
  property int menuIndex: 0
  readonly property var menuItems: ["Resume", "Copy seed", "Main menu"]
  readonly property var devKills: Messages.KILLABLE_SOURCES.map(function(source) { return { source: source, small: false } })
    .concat([{ source: "fork", small: true }])
  property int devHitIndex: 0
  property int devKillIndex: 0

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

  function newSeed() {
    return Math.floor(Math.random() * 0x100000000)
  }

  function startingRun(seed) {
    return Run.createRun(seed, Validator.playableLevel(seed, 1))
  }

  function advanceLevel() {
    Run.nextLevel(run, Validator.playableLevel(run.seed, run.levelNumber + 1))
    showWorld()
  }

  function showWorld() {
    world = run.world
    clock = Clock.createClock()
    gameView.sync()
  }

  function startRun(seed) {
    run = startingRun(seed)
    showWorld()
  }

  function finishWaiting() {
    if (run.over) startRun(run.seed)
    else if (run.levelNumber === Run.LEVEL_COUNT) startRun(newSeed())
    else advanceLevel()
  }

  function openMenu() {
    if (run.over) return
    releaseKeys()
    paused = false
    menuIndex = 0
    menuOpen = true
  }

  function copySeed() {
    Quickshell.execDetached(["wl-copy", "--", Seed.formatSeed(run.seed)])
    Run.showToast(run, Messages.EVENTS.seedCopied, "cyan")
    gameView.sync()
  }

  function activateMenu() {
    const item = menuItems[menuIndex]
    if (item === "Copy seed") {
      copySeed()
      return
    }
    menuOpen = false
    if (item === "Main menu") startRun(newSeed())
  }

  function menuKey(key) {
    if (key === Qt.Key_Escape) menuOpen = false
    else if (key === Qt.Key_Up) menuIndex = (menuIndex + menuItems.length - 1) % menuItems.length
    else if (key === Qt.Key_Down) menuIndex = (menuIndex + 1) % menuItems.length
    else if (key === Qt.Key_Return || key === Qt.Key_Enter || key === Qt.Key_Space) activateMenu()
  }

  function devKey(key) {
    if (key === Qt.Key_H) {
      Run.hitHero(run, Messages.ENEMY_SOURCES[devHitIndex++ % Messages.ENEMY_SOURCES.length])
    } else if (key === Qt.Key_K) {
      const kill = devKills[devKillIndex++ % devKills.length]
      Run.killEnemy(run, kill.source, world.hero.x, world.hero.y - 60, kill.small)
    } else if (key === Qt.Key_L) {
      if (run.levelNumber < Run.LEVEL_COUNT) advanceLevel()
    } else return false
    return true
  }

  function frame(frameTime) {
    if (paused || menuOpen) return
    const waiting = run.over || world.finished
    const steps = Clock.stepsFor(clock, frameTime)
    for (let i = 0; i < steps; i++) {
      const input = { direction: (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0), jumpHeld: jumpHeld, jumpPressed: jumpPressed && !waiting }
      Run.stepRun(run, input, Clock.STEP_SECONDS)
      if (!waiting) jumpPressed = false
    }
    if (waiting && jumpPressed) finishWaiting()
    jumpPressed = false
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
      root.openMenu()
      if (!root.closingFromHost && root.shell) root.shell.hide(root.pluginId)
    }

    FocusScope {
      id: keyCatcher
      anchors.fill: parent
      focus: true

      Keys.onPressed: function(event) {
        if (root.menuOpen) {
          if (!event.isAutoRepeat || event.key === Qt.Key_Up || event.key === Qt.Key_Down) root.menuKey(event.key)
          event.accepted = true
        } else if (event.key === Qt.Key_Escape) {
          if (!event.isAutoRepeat) root.openMenu()
          event.accepted = true
        } else if (root.devTools && !event.isAutoRepeat && root.devKey(event.key)) {
          event.accepted = true
        } else if (event.key === Qt.Key_P) {
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
        run: root.run
        world: root.world
        paused: root.paused
        menuOpen: root.menuOpen
        menuIndex: root.menuIndex
        menuItems: root.menuItems
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
