import QtQuick
import QtQuick.Effects
import "scene.mjs" as Scene

Item {
  id: renderer

  property var scene
  property var palette
  property real scaleFactor: 1
  property real pixelRatio: 1
  property bool fullEffects: true
  readonly property string fontFamily: "JetBrainsMono Nerd Font"
  readonly property var levelGlyphs: Scene.buildLevel(7)
  readonly property var hexdump: Scene.buildHexdump(7)
  readonly property real texelScale: scaleFactor * pixelRatio
  readonly property size layerSize: Qt.size(Scene.LEVEL_WIDTH * texelScale, Scene.H * texelScale)
  readonly property size screenLayerSize: Qt.size(Scene.W * texelScale, Scene.H * texelScale)

  function sync() {
    const s = scene
    const cam = Math.round(s.camX)
    far.x = -cam * 0.3
    near.x = -cam * 0.6
    worldContent.x = -cam + s.shakeX
    worldContent.y = s.shakeY
    dynamicWorld.x = -cam + s.shakeX
    dynamicWorld.y = s.shakeY
    for (let i = 0; i < movers.count; i++) {
      const m = s.movers[i]
      const item = movers.itemAt(i)
      item.x = m.x
      item.y = m.y
    }
    heroTop.x = s.hero.x
    heroTop.y = s.hero.y - 22
    heroBottom.x = s.hero.x
    heroBottom.y = s.hero.y
    for (let i = 0; i < particles.count; i++) {
      const q = s.particles[i]
      const item = particles.itemAt(i)
      item.visible = q.alive
      if (!q.alive) continue
      item.x = q.x
      item.y = q.y
      item.opacity = q.opacity
      item.text = q.ch
      item.color = renderer.palette[q.role]
    }
  }

  component Glyph: Text {
    property real size: 20
    font { family: renderer.fontFamily; pixelSize: size; bold: true }
  }

  component CenteredGlyph: Glyph {
    transform: Translate { x: -width / 2; y: -height }
  }

  component GlowGroup: Item {
    id: group
    default property alias content: inner.data
    property real glow: 0.5
    property size textureSize: renderer.layerSize
    width: Scene.LEVEL_WIDTH
    height: Scene.H

    MultiEffect {
      anchors.fill: inner
      source: inner
      visible: renderer.fullEffects
      autoPaddingEnabled: true
      blurEnabled: true
      blur: group.glow
      blurMax: 16
      brightness: 0.15
    }

    Item {
      id: inner
      width: group.width
      height: group.height
      layer.enabled: renderer.fullEffects
      layer.textureSize: group.textureSize
    }
  }

  Item {
    id: layers
    width: Scene.W
    height: Scene.H
    transform: Scale { xScale: renderer.scaleFactor; yScale: renderer.scaleFactor }

    Item {
      id: far
      width: Scene.LEVEL_WIDTH
      height: Scene.H
      layer.enabled: true
      layer.textureSize: renderer.layerSize
      Repeater {
        model: renderer.hexdump.far
        Glyph { x: modelData.x; y: modelData.y; text: modelData.text; size: 11; color: renderer.palette.hexFar }
      }
    }

    Item {
      id: near
      width: Scene.LEVEL_WIDTH
      height: Scene.H
      layer.enabled: true
      layer.textureSize: renderer.layerSize
      Repeater {
        model: renderer.hexdump.near
        Glyph { x: modelData.x; y: modelData.y; text: modelData.text; size: 12; color: renderer.palette.hexNear }
      }
    }

    Item {
      id: worldContent
      width: Scene.LEVEL_WIDTH
      height: Scene.H

      Item {
        id: levelCache
        width: Scene.LEVEL_WIDTH
        height: Scene.H
        layer.enabled: true
        layer.textureSize: renderer.layerSize

        GlowGroup {
          glow: 0.35
          Repeater {
            model: renderer.levelGlyphs.filter(g => g.role !== "muted")
            Glyph { x: modelData.x; y: modelData.y; text: modelData.ch; size: modelData.size; color: renderer.palette[modelData.role] }
          }
        }

        Repeater {
          model: renderer.levelGlyphs.filter(g => g.role === "muted")
          Glyph { x: modelData.x; y: modelData.y; text: modelData.ch; size: modelData.size; color: renderer.palette.muted }
        }
      }

    }

    GlowGroup {
      width: Scene.W
      height: Scene.H
      glow: 0.5
      textureSize: renderer.screenLayerSize

      Item {
        id: dynamicWorld

        Repeater {
          id: movers
          model: renderer.scene.movers

          Item {
            CenteredGlyph {
              text: modelData.ch
              size: modelData.size
              color: renderer.palette[modelData.role]
            }
            CenteredGlyph {
              y: -30
              visible: modelData.label !== undefined
              text: modelData.label || ""
              size: 10
              color: renderer.palette[modelData.role]
            }
            CenteredGlyph {
              y: -26
              visible: modelData.motion === "hang"
              text: "│"
              size: 20
              color: renderer.palette.muted
            }
          }
        }

        Item {
          id: heroTop
          CenteredGlyph { text: "@"; size: 28; color: renderer.palette.hero }
        }

        Item {
          id: heroBottom
          CenteredGlyph { text: "@"; size: 28; color: renderer.palette.hero }
        }

        Repeater {
          id: particles
          model: Scene.PARTICLE_COUNT
          Glyph {
            size: 14
            visible: false
            transform: Translate { x: -width / 2; y: -height / 2 }
          }
        }
      }
    }
  }
}
