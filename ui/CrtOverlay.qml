import QtQuick

Canvas {
  id: crt

  readonly property int scanlines: 180
  readonly property real scanlineAlpha: 0.035
  readonly property real vignetteAlpha: 0.08

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()

  onPaint: {
    const ctx = getContext("2d")
    ctx.reset()
    ctx.fillStyle = Qt.rgba(0, 0, 0, scanlineAlpha)
    const step = height / scanlines
    for (let y = 0; y < height; y += step) ctx.fillRect(0, y, width, step / 3)
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.95)
    gradient.addColorStop(0, Qt.rgba(0, 0, 0, 0))
    gradient.addColorStop(1, Qt.rgba(0, 0, 0, vignetteAlpha))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
}
