import QtQuick
import QtQuick.Effects

Item {
  id: glitch

  property Item source
  property size textureSize
  property real strength: 0
  property int sliceCount: 0
  readonly property bool active: strength > 0
  readonly property real splitOffset: 6
  readonly property real splitOpacity: 0.35

  function sync(slices) {
    for (let i = 0; i < sliceCount; i++) {
      const slice = slices[i]
      const item = sliceItems.itemAt(i)
      item.visible = slice !== undefined
      if (!slice) continue
      item.y = slice.y
      item.height = slice.height
      item.offset = slice.dx
    }
  }

  ShaderEffectSource {
    id: capture
    anchors.fill: parent
    sourceItem: glitch.source
    textureSize: glitch.textureSize
    live: glitch.active
    hideSource: glitch.active
    visible: glitch.active
  }

  MultiEffect {
    x: -glitch.splitOffset
    width: glitch.width
    height: glitch.height
    source: capture
    visible: glitch.active
    colorization: 1
    colorizationColor: "#ff3048"
    opacity: glitch.splitOpacity * Math.min(glitch.strength, 1)
  }

  MultiEffect {
    x: glitch.splitOffset
    width: glitch.width
    height: glitch.height
    source: capture
    visible: glitch.active
    colorization: 1
    colorizationColor: "#30e0ff"
    opacity: glitch.splitOpacity * Math.min(glitch.strength, 1)
  }

  Repeater {
    id: sliceItems
    model: glitch.sliceCount

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
