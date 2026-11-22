import QtQuick

Item {
  property var scene
  property var palette
  property real scaleFactor: 1
  property real pixelRatio: 1
  property bool fullEffects: true

  function sync() {
    marker.x = scene.time * 60 % width
  }

  Rectangle {
    id: marker
    width: 2
    height: 2
    color: "#333"
  }
}
