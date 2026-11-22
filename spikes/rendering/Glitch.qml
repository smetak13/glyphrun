import QtQuick
import QtQuick.Effects

Item {
  id: glitch

  property Item source
  property var scene
  property real scaleFactor: 1
  property real strength: 0
  readonly property bool active: strength > 0

  function sync() {
    if (!active) return
    for (let i = 0; i < slices.count; i++) {
      const s = scene.glitchSlices[i]
      const slice = slices.itemAt(i)
      slice.y = s.y * scaleFactor
      slice.height = s.h * scaleFactor
      slice.offset = s.dx * scaleFactor
    }
  }

  ShaderEffectSource {
    id: capture
    anchors.fill: parent
    sourceItem: glitch.source
    live: glitch.active
    hideSource: glitch.active
    visible: glitch.active
  }

  MultiEffect {
    x: -6 * glitch.scaleFactor
    width: glitch.width
    height: glitch.height
    source: capture
    visible: glitch.active
    colorization: 1
    colorizationColor: "#ff3048"
    opacity: 0.35 * glitch.strength
  }

  MultiEffect {
    x: 6 * glitch.scaleFactor
    width: glitch.width
    height: glitch.height
    source: capture
    visible: glitch.active
    colorization: 1
    colorizationColor: "#30e0ff"
    opacity: 0.35 * glitch.strength
  }

  Repeater {
    id: slices
    model: 8

    Item {
      property real offset: 0
      width: glitch.width
      clip: true
      visible: glitch.active

      ShaderEffect {
        x: parent.offset
        y: -parent.y
        width: glitch.width
        height: glitch.height
        property variant source: capture
      }
    }
  }
}
