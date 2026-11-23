import QtQuick
import QtCore
import Quickshell
import Quickshell.Io
import "ui"
import "logic/audio.mjs" as AudioLogic
import "logic/clock.mjs" as Clock
import "logic/effects.mjs" as Effects
import "logic/frameRate.mjs" as FrameRate
import "logic/highScores.mjs" as HighScores
import "logic/menu.mjs" as Menu
import "logic/messages.mjs" as Messages
import "logic/run.mjs" as Run
import "logic/screen.mjs" as Screen
import "logic/seed.mjs" as Seed
import "logic/story.mjs" as Story
import "logic/boss.mjs" as Boss
import "logic/validator.mjs" as Validator

Item {
  id: root

  property var shell: null
  readonly property string pluginId: "smetak13.glyphrun"
  readonly property bool opened: window.visible
  property bool closingFromHost: false
  property bool devTools: false
  property var run: null
  property var world: null
  property var clock: Clock.createClock()
  property var effects: Effects.createEffects()
  property var frameWatcher: FrameRate.createFrameWatcher()
  property bool autoReduced: false
  property bool stageEnded: false
  property bool leftHeld: false
  property bool rightHeld: false
  property bool jumpHeld: false
  property bool jumpPressed: false
  property bool paused: false
  property bool menuOpen: false
  property string screen: "menu"
  property int levelNumber: 1
  property real screenTime: 0
  property real summaryTime: 0
  readonly property real summaryReadySeconds: 1.6
  property int menuIndex: 0
  property var mainItems: Menu.mainMenuItems(null)
  property string seedText: ""
  property string seedError: ""
  property var clipboardSeed: null
  property bool pasteRequested: false
  property int scoreRow: 0
  property int scoreAction: 0
  property int rank: 0
  property var recordedRun: null
  readonly property var scores: HighScores.parseScores(storage.highScores)
  readonly property bool fullEffects: storage.effects === "full"
  readonly property var settingsItems: [
    "Effects: " + storage.effects,
    "Music volume: " + Menu.percent(storage.musicVolume),
    "Sound volume: " + Menu.percent(storage.soundVolume),
    "Mute: " + (storage.muted ? "on" : "off"),
  ]
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

  function showScreen(name) {
    releaseKeys()
    screen = name
    screenTime = 0
    menuIndex = 0
  }

  function showMainMenu() {
    mainItems = Menu.mainMenuItems(run)
    menuOpen = false
    paused = false
    showScreen("menu")
  }

  function showWorld() {
    world = run.world
    levelNumber = run.levelNumber
    clock = Clock.createClock()
    summaryTime = 0
    stageEnded = false
    Effects.clearEffects(effects)
    audio.startTrack(AudioLogic.trackFor(run.seed, run.levelNumber))
    if (gameLoader.item) gameLoader.item.sync()
  }

  function startRun(seed, withIntro) {
    const next = Run.createRun(seed, Validator.playableLevel(seed, 1))
    world = next.world
    run = next
    rank = 0
    paused = false
    menuOpen = false
    showWorld()
    showScreen(withIntro ? "intro" : "title")
  }

  function advanceLevel() {
    Run.nextLevel(run, Validator.playableLevel(run.seed, run.levelNumber + 1))
    showWorld()
  }

  function finishLevel() {
    if (run.levelNumber < Run.LEVEL_COUNT) {
      advanceLevel()
      showScreen("title")
    } else showScreen("shipped")
  }

  function startBoss() {
    Run.nextLevel(run, Boss.arenaLevel(run.seed))
    showWorld()
    showScreen("play")
  }

  function recordScore() {
    if (recordedRun === run) return
    recordedRun = run
    const result = HighScores.insertScore(scores, HighScores.scoreEntry(run, Qt.formatDate(new Date(), "yyyy-MM-dd")))
    rank = result.rank
    storage.highScores = JSON.stringify(result.scores)
    menuIndex = 0
  }

  function showNotice(text, milliseconds) {
    notice.text = text
    noticeTimer.interval = milliseconds
    noticeTimer.restart()
  }

  function copySeed(seed) {
    Quickshell.execDetached(["wl-copy", "--", Seed.formatSeed(seed)])
    clipboardSeed = seed
    showNotice(Messages.EVENTS.seedCopied, 1600)
  }

  function watchFrameRate(frameTime) {
    if (!fullEffects || autoReduced) return
    if (!FrameRate.watchFrame(frameWatcher, frameTime)) return
    autoReduced = true
    storage.effects = "reduced"
    showNotice(Messages.EVENTS.effectsReduced, 4000)
  }

  function playCues() {
    for (const cue of Run.takeCues(run)) {
      Effects.applyCue(effects, cue)
      audio.play(cue.name)
    }
  }

  function openMenu() {
    if (screen !== "play" || run.over) return
    releaseKeys()
    paused = false
    menuIndex = 0
    menuOpen = true
  }

  function isConfirm(key) {
    return key === Qt.Key_Return || key === Qt.Key_Enter || key === Qt.Key_Space
  }

  function listKey(key, items, activate) {
    if (key === Qt.Key_Up || key === Qt.Key_Down) {
      menuIndex = Menu.moveIndex(menuIndex, key === Qt.Key_Up ? -1 : 1, items.length)
      audio.play("menu-move")
    } else if (isConfirm(key)) {
      audio.play("menu-select")
      activate(items[menuIndex])
    }
  }

  function activateMain(item) {
    if (item === "Continue") showScreen("play")
    else if (item === "New run") startRun(newSeed(), true)
    else if (item === "Enter seed") {
      seedText = ""
      seedError = ""
      readClipboard(false)
      showScreen("seed")
    } else if (item === "High scores") {
      scoreRow = 0
      scoreAction = 0
      showScreen("scores")
    } else if (item === "Settings") showScreen("settings")
  }

  function activatePause(item) {
    if (item === "Resume") menuOpen = false
    else if (item === "Copy seed") copySeed(run.seed)
    else if (item === "Main menu") showMainMenu()
  }

  function activateEnd(item) {
    if (item === "Retry this seed from level 1") startRun(run.seed, false)
    else if (item === "New seed" || item === "New run") startRun(newSeed(), true)
    else if (item === "Copy seed") copySeed(run.seed)
    else if (item === "Main menu") showMainMenu()
  }

  function readClipboard(paste) {
    pasteRequested = paste
    clipboardReader.running = true
  }

  function clipboardRead(text) {
    clipboardSeed = Seed.parseSeed(text)
    if (!pasteRequested) return
    pasteRequested = false
    if (clipboardSeed === null) seedError = Messages.EVENTS.nothingToPaste
    else {
      seedText = Seed.formatSeed(clipboardSeed)
      seedError = ""
    }
  }

  function isPaste(event) {
    return (event.key === Qt.Key_V && (event.modifiers & Qt.ControlModifier))
      || (event.key === Qt.Key_Insert && (event.modifiers & Qt.ShiftModifier))
  }

  function seedKey(event) {
    if (event.key === Qt.Key_Escape) showMainMenu()
    else if (isPaste(event)) readClipboard(true)
    else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
      const seed = Seed.parseSeed(seedText)
      if (seed === null) seedError = Messages.EVENTS.seedRejected
      else startRun(seed, true)
    } else if (event.key === Qt.Key_Backspace) {
      seedText = seedText.slice(0, -1)
      seedError = ""
    } else if (event.text !== "") {
      seedText = Seed.typeSeed(seedText, event.text)
      seedError = ""
    }
  }

  function scoresKey(key) {
    if (key === Qt.Key_Escape) showMainMenu()
    else if (scores.length === 0) return
    else if (key === Qt.Key_Up || key === Qt.Key_Down) {
      scoreRow = Menu.moveIndex(scoreRow, key === Qt.Key_Up ? -1 : 1, scores.length)
      audio.play("menu-move")
    } else if (key === Qt.Key_Left || key === Qt.Key_Right) {
      scoreAction = 1 - scoreAction
      audio.play("menu-move")
    } else if (isConfirm(key)) {
      audio.play("menu-select")
      const seed = scores[scoreRow].seed
      if (Menu.SCORE_ACTIONS[scoreAction] === "play") startRun(seed, true)
      else copySeed(seed)
    }
  }

  function changeSetting(setting, direction) {
    if (setting === "effects") storage.effects = storage.effects === "full" ? "reduced" : "full"
    else if (setting === "music") storage.musicVolume = Menu.stepVolume(storage.musicVolume, direction)
    else if (setting === "sound") storage.soundVolume = Menu.stepVolume(storage.soundVolume, direction)
    else if (setting === "mute") storage.muted = !storage.muted
    audio.play(setting === "sound" ? "bit" : "menu-select")
  }

  function settingsKey(key) {
    if (key === Qt.Key_Escape) showMainMenu()
    else if (key === Qt.Key_Left || key === Qt.Key_Right) changeSetting(Menu.SETTINGS[menuIndex], key === Qt.Key_Left ? -1 : 1)
    else listKey(key, Menu.SETTINGS, function(setting) { changeSetting(setting, 1) })
  }

  function victoryKey(key) {
    if (Story.victoryScene(screenTime).ending) listKey(key, Menu.VICTORY_ITEMS, activateEnd)
    else if (isConfirm(key)) screenTime = Story.ENDING_AT
  }

  function playKey(event) {
    const key = event.key
    const repeatable = key === Qt.Key_Up || key === Qt.Key_Down
    if (menuOpen) {
      if (key === Qt.Key_Escape && !event.isAutoRepeat) menuOpen = false
      else if (!event.isAutoRepeat || repeatable) listKey(key, Menu.PAUSE_ITEMS, activatePause)
      return true
    }
    if (run.over) {
      if (!event.isAutoRepeat || repeatable) listKey(key, Menu.GAME_OVER_ITEMS, activateEnd)
      return true
    }
    if (key === Qt.Key_Escape) {
      if (!event.isAutoRepeat) {
        openMenu()
        audio.play("pause")
      }
      return true
    }
    if (event.isAutoRepeat) return false
    if (devTools && devKey(key)) return true
    if (key === Qt.Key_P) {
      paused = !paused
      audio.play("pause")
      return true
    }
    if (world.finished && isConfirm(key)) {
      if (summaryTime >= summaryReadySeconds) finishLevel()
      return true
    }
    return setHeld(key, true)
  }

  function keyPressed(event) {
    const key = event.key
    if (screen === "play") return playKey(event)
    const repeatable = key === Qt.Key_Up || key === Qt.Key_Down || key === Qt.Key_Backspace
    if (event.isAutoRepeat && !repeatable) return true
    if (screen === "menu") listKey(key, mainItems, activateMain)
    else if (screen === "seed") seedKey(event)
    else if (screen === "scores") scoresKey(key)
    else if (screen === "settings") settingsKey(key)
    else if (screen === "intro") showScreen("title")
    else if (screen === "title") {
      showScreen("play")
      setHeld(key, true)
    } else if (screen === "shipped") {
      if (key !== Qt.Key_Space) return true
      if (screenTime < Story.SHIPPED_TYPED_SECONDS) screenTime = Story.SHIPPED_TYPED_SECONDS
      else startBoss()
    } else if (screen === "victory") victoryKey(key)
    return true
  }

  function devKey(key) {
    if (key === Qt.Key_H) {
      Run.hitHero(run, Messages.ENEMY_SOURCES[devHitIndex++ % Messages.ENEMY_SOURCES.length])
    } else if (key === Qt.Key_K) {
      const kill = devKills[devKillIndex++ % devKills.length]
      Run.killEnemy(run, kill.source, world.hero.x, world.hero.y - 60, kill.small)
    } else if (key === Qt.Key_L) {
      if (run.levelNumber < Run.LEVEL_COUNT) advanceLevel()
    } else if (key === Qt.Key_B) {
      if (!world.boss) {
        run.levelNumber = Run.LEVEL_COUNT
        startBoss()
      }
    } else if (key === Qt.Key_V) {
      showScreen("victory")
    } else return false
    return true
  }

  function frame(frameTime) {
    if (screen !== "play") {
      FrameRate.resetFrameWatcher(frameWatcher)
      screenTime += frameTime
      if (screen === "intro" && Story.introDone(screenTime)) showScreen("title")
      else if (screen === "title" && screenTime >= Story.TITLE_SECONDS) showScreen("play")
      return
    }
    if (paused || menuOpen) {
      FrameRate.resetFrameWatcher(frameWatcher)
      return
    }
    watchFrameRate(frameTime)
    const waiting = run.over || world.finished
    const steps = Clock.stepsFor(clock, frameTime)
    for (let i = 0; i < steps; i++) {
      const input = { direction: (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0), jumpHeld: jumpHeld, jumpPressed: jumpPressed && !waiting }
      Run.stepRun(run, input, Clock.STEP_SECONDS)
      if (!waiting) jumpPressed = false
    }
    jumpPressed = false
    playCues()
    Effects.stepEffects(effects, frameTime)
    stageEnded = run.over || world.finished
    if (run.won) {
      recordScore()
      showScreen("victory")
      return
    }
    if (run.over) recordScore()
    if (world.finished) summaryTime += frameTime
    gameLoader.item.sync()
  }

  Settings {
    id: storage
    location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/glyphrun.ini"
    category: "glyphrun"
    property string highScores: "[]"
    property string effects: "full"
    property real musicVolume: 0.6
    property real soundVolume: 0.8
    property bool muted: false
  }

  AudioController {
    id: audio
    musicVolume: storage.musicVolume
    soundVolume: storage.soundVolume
    muted: storage.muted
    musicRunning: root.opened && root.screen === "play" && !root.paused && !root.menuOpen && !root.stageEnded
  }

  Process {
    id: clipboardReader
    command: ["wl-paste", "--no-newline", "--type", "text"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.clipboardRead(String(text))
    }
  }

  Timer {
    id: noticeTimer
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
        event.accepted = root.keyPressed(event)
      }
      Keys.onReleased: function(event) {
        if (!event.isAutoRepeat) event.accepted = root.setHeld(event.key, false)
      }

      Loader {
        id: gameLoader
        anchors.fill: parent
        active: root.run !== null
        visible: root.screen === "play"

        sourceComponent: GameView {
          run: root.run
          world: root.world
          paused: root.paused
          menuOpen: root.menuOpen
          menuIndex: root.menuIndex
          menuItems: Menu.PAUSE_ITEMS
          overItems: Menu.GAME_OVER_ITEMS
          summaryTime: root.summaryTime
          summaryReady: root.summaryTime >= root.summaryReadySeconds
          rank: root.rank
          colors: theme.colors
          effects: root.effects
          fullEffects: root.fullEffects
          pixelRatio: window.devicePixelRatio
        }
      }

      ScaledStage {
        anchors.fill: parent
        visible: root.screen !== "play"

        MainMenu {
          anchors.fill: parent
          visible: root.screen === "menu"
          items: root.mainItems
          index: root.menuIndex
          colors: theme.colors
        }

        SeedEntry {
          anchors.fill: parent
          visible: root.screen === "seed"
          text: root.seedText
          error: root.seedError
          clipboard: root.clipboardSeed === null ? "" : Seed.formatSeed(root.clipboardSeed)
          time: root.screenTime
          colors: theme.colors
        }

        HighScores {
          anchors.fill: parent
          visible: root.screen === "scores"
          scores: root.scores
          row: root.scoreRow
          action: root.scoreAction
          colors: theme.colors
        }

        SettingsScreen {
          anchors.fill: parent
          visible: root.screen === "settings"
          items: root.settingsItems
          index: root.menuIndex
          colors: theme.colors
        }

        Intro {
          anchors.fill: parent
          visible: root.screen === "intro"
          time: root.screenTime
          colors: theme.colors
        }

        TitleCard {
          anchors.fill: parent
          visible: root.screen === "title"
          levelNumber: root.levelNumber
          time: root.screenTime
          colors: theme.colors
        }

        Shipped {
          anchors.fill: parent
          visible: root.screen === "shipped"
          time: root.screenTime
          colors: theme.colors
        }

        Loader {
          anchors.fill: parent
          active: root.screen === "victory"

          sourceComponent: Victory {
            run: root.run
            time: root.screenTime
            rank: root.rank
            items: Menu.VICTORY_ITEMS
            index: root.menuIndex
            colors: theme.colors
          }
        }
      }

      CrtOverlay {
        readonly property real gameScale: Math.min(parent.width / Screen.SCREEN_WIDTH, parent.height / Screen.SCREEN_HEIGHT)
        anchors.centerIn: parent
        width: Screen.SCREEN_WIDTH * gameScale
        height: Screen.SCREEN_HEIGHT * gameScale
        visible: root.fullEffects
      }

      ScaledStage {
        anchors.fill: parent

        Rectangle {
          anchors.horizontalCenter: parent.horizontalCenter
          y: 470
          width: notice.width + 40
          height: 34
          visible: noticeTimer.running
          color: Qt.alpha(theme.colors.background, 0.85)

          Glyph {
            id: notice
            anchors.centerIn: parent
            size: 16
            color: theme.colors.cyan
          }
        }
      }
    }

    FrameAnimation {
      running: window.visible
      onTriggered: root.frame(frameTime)
    }
  }
}
