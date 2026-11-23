import QtQuick
import QtQuick.Effects

Item {
  id: group

  default property alias content: inner.data
  property bool glowing: true
  property real glow: 0.5
  property real glowOpacity: 0.5
  property size textureSize

  MultiEffect {
    anchors.fill: inner
    source: inner
    visible: group.glowing
    autoPaddingEnabled: false
    blurEnabled: true
    blur: group.glow
    blurMax: 8
    opacity: group.glowOpacity
  }

  Item {
    id: inner
    width: group.width
    height: group.height
    layer.enabled: group.glowing
    layer.textureSize: group.textureSize
  }
}
