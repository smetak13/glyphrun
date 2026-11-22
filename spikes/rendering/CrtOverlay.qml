import QtQuick

Canvas {
  id: crt

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()

  onPaint: {
    const ctx = getContext("2d")
    ctx.reset()
    ctx.fillStyle = "rgba(0,0,0,0.22)"
    const step = height / 180
    for (let y = 0; y < height; y += step) ctx.fillRect(0, y, width, step / 3)
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.95)
    gradient.addColorStop(0, "rgba(0,0,0,0)")
    gradient.addColorStop(1, "rgba(0,0,0,0.55)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }
}
