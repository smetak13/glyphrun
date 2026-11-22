import QtQuick
import QtQuick.Effects
import Quickshell
import "scene.mjs" as Scene

ShellRoot {
  id: root

  readonly property string renderer: Quickshell.env("SPIKE_RENDERER") || "canvas"
  readonly property bool fullEffects: (Quickshell.env("SPIKE_EFFECTS") || "full") === "full"
  readonly property int targetWidth: Number(Quickshell.env("SPIKE_WIDTH") || 1920)
  readonly property real warmupSeconds: 3
  readonly property real measureSeconds: Number(Quickshell.env("SPIKE_SECONDS") || 10)
  readonly property var palette: Scene.KANAGAWA
  property var scene: Scene.createScene(7)
  property int frame: 0
  property real elapsed: 0
  property var intervals: []
  property var calmIntervals: []
  property var glitchIntervals: []
  property int paintSamplesBefore: 0
  property int paintedBefore: 0
  property bool measuring: false
  property var updateTimes: []
  property bool reported: false

  FloatingWindow {
    id: window
    title: "glyphrun-spike"
    implicitWidth: 1920
    implicitHeight: 1080
    visible: true
    color: root.palette.backdrop

    Item {
      id: stage
      readonly property real scaleFactor: Math.min(window.width / Scene.W, window.height / Scene.H)
      width: Scene.W * scaleFactor
      height: Scene.H * scaleFactor
      anchors.centerIn: parent
      clip: true

      Item {
        id: gameScene
        anchors.fill: parent

        Loader {
          id: rendererLoader
          anchors.fill: parent
          active: window.width === root.targetWidth
          source: ({ canvas: "CanvasRenderer.qml", items: "ItemsRenderer.qml", empty: "EmptyRenderer.qml" })[root.renderer]
          onLoaded: {
            item.scene = root.scene
            item.palette = root.palette
            item.scaleFactor = Qt.binding(() => stage.scaleFactor)
            item.pixelRatio = Qt.binding(() => window.devicePixelRatio)
            item.fullEffects = root.fullEffects
          }
        }

        Hud {
          anchors.fill: parent
          scaleFactor: stage.scaleFactor
          palette: root.palette
          time: root.elapsed
        }
      }

      Glitch {
        anchors.fill: parent
        source: gameScene
        scene: root.scene
        scaleFactor: stage.scaleFactor
        strength: root.fullEffects ? glitchStrength : 0
        property real glitchStrength: 0
        id: glitch
      }

      CrtOverlay {
        anchors.fill: parent
        visible: root.fullEffects
      }
    }

    FrameAnimation {
      running: rendererLoader.status === Loader.Ready
      onTriggered: {
        const wasGlitching = root.scene.glitch > 0
        const started = Date.now()
        Scene.stepScene(root.scene, Math.min(frameTime, 0.05))
        rendererLoader.item.sync()
        glitch.glitchStrength = root.scene.glitch
        glitch.sync()
        const finished = Date.now()
        root.frame++
        root.elapsed += frameTime
        if (root.elapsed > root.warmupSeconds && !root.measuring) root.startMeasuring()
        if (root.measuring && !root.reported) {
          root.intervals.push(frameTime * 1000)
          ;(wasGlitching && root.fullEffects ? root.glitchIntervals : root.calmIntervals).push(frameTime * 1000)
          root.updateTimes.push(finished - started)
        }
        if (root.elapsed > root.warmupSeconds + root.measureSeconds && !root.reported) root.report()
      }
    }
  }

  function startMeasuring() {
    measuring = true
    paintSamplesBefore = rendererLoader.item.paintTimes ? rendererLoader.item.paintTimes.length : 0
    paintedBefore = rendererLoader.item.paintedFrames || 0
    console.log("SPIKE_MEASURE_START")
  }

  function report() {
    reported = true
    const result = {
      renderer: renderer,
      effects: fullEffects ? "full" : "reduced",
      windowLogical: [window.width, window.height],
      devicePixelRatio: window.devicePixelRatio,
      gamePixels: [Math.round(stage.width * window.devicePixelRatio), Math.round(stage.height * window.devicePixelRatio)],
      frameIntervalMs: Scene.summarize(intervals),
      calmFrameIntervalMs: Scene.summarize(calmIntervals),
      glitchFrameIntervalMs: glitchIntervals.length ? Scene.summarize(glitchIntervals) : null,
      guiUpdateMs: Scene.summarize(updateTimes),
      canvasPaintedFps: rendererLoader.item.paintedFrames === undefined ? null : (rendererLoader.item.paintedFrames - paintedBefore) / (elapsed - warmupSeconds),
      paintMs: rendererLoader.item.paintTimes ? Scene.summarize(rendererLoader.item.paintTimes.slice(paintSamplesBefore)) : null,
    }
    console.log("SPIKE_RESULT " + JSON.stringify(result))
  }
}
