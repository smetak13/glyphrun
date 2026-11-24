import QtQuick
import "../logic/screen.mjs" as Screen
import "../logic/level.mjs" as Level
import "../logic/run.mjs" as Run
import "../logic/seed.mjs" as Seed
import "../logic/backdrop.mjs" as BackdropLogic
import "../logic/effects.mjs" as Effects
import "../logic/physics.mjs" as Physics
import "../logic/heroFigure.mjs" as HeroFigureLogic

Item {
  id: view

  property var run
  property var world
  property var heroAnimator
  property int heroDirection: 0
  property bool paused: false
  property bool menuOpen: false
  property int menuIndex: 0
  property var menuItems: []
  property var overItems: []
  property real summaryTime: 0
  property bool summaryReady: false
  property int rank: 0
  property var colors
  property var effects
  property bool fullEffects: true
  property real pixelRatio: 1
  readonly property real gameScale: Math.min(width / Screen.SCREEN_WIDTH, height / Screen.SCREEN_HEIGHT)
  readonly property real texelScale: gameScale * pixelRatio
  readonly property size screenTexture: Qt.size(Screen.SCREEN_WIDTH * texelScale, Screen.SCREEN_HEIGHT * texelScale)
  readonly property var backdrop: BackdropLogic.backdropLayers()
  readonly property var sections: Level.levelSections(world.level)
  property bool checkpointLit: false
  property bool finished: false
  property bool over: false
  property string hudLeft: ""
  property string hudRight: ""
  property string hudLives: ""
  property bool livesGained: false
  property bool livesFlashing: false
  property string overCause: ""
  readonly property real heroBaselineDrop: 2
  readonly property int popupPoolSize: 8
  readonly property real popupRise: 40
  readonly property real trailGap: 22
  readonly property real trailSpeed: Physics.WALK_SPEED
  readonly property real flashOpacity: 0.9

  function stageName() {
    return run.levelNumber > Run.LEVEL_COUNT ? "KERNEL PANIC" : "level " + run.levelNumber + "/" + Run.LEVEL_COUNT
  }

  function pad(value, length) {
    return String(value).padStart(length, "0")
  }

  function heroBlinkedOut() {
    return run.over || (run.invulnerable > 0 && Math.floor(run.invulnerable * 16) % 2 === 0)
  }

  function heroParts(pose, dying) {
    const parts = HeroFigureLogic.heroParts(pose, HeroFigureLogic.shownBig(heroAnimator, world.hero), heroAnimator.facing, heroAnimator.time, Math.abs(world.hero.vx))
    return dying ? HeroFigureLogic.deathParts(parts, Run.DEATH_SECONDS - run.dying) : parts
  }

  function syncHero() {
    const dying = run.dying > 0
    const state = dying ? "dead" : HeroFigureLogic.heroState(heroAnimator, world.hero, world.level, heroDirection)
    const pose = HeroFigureLogic.heroPose(state, heroAnimator.time)
    hero.x = Math.round(world.hero.x)
    hero.y = Math.round(world.hero.y)
    hero.parts = heroParts(pose, dying)
    hero.lean = pose.lean * heroAnimator.facing
    hero.stretchX = pose.scaleX
    hero.stretchY = pose.scaleY
    hero.visible = !heroBlinkedOut()
    const direction = world.hero.vx > 0 ? 1 : -1
    trail.visible = hero.visible && !dying && world.hero.grounded && Math.abs(world.hero.vx) > trailSpeed
    trail.text = direction > 0 ? "»" : "«"
    trail.x = Math.round(world.hero.x - direction * trailGap - trail.width / 2)
    trail.y = Math.round(world.hero.y - trail.height + heroBaselineDrop)
  }

  function syncEffects() {
    shaken.x = Math.round(effects.shakeX)
    shaken.y = Math.round(effects.shakeY)
    for (let i = 0; i < particles.count; i++) {
      const particle = effects.particles[i]
      const item = particles.itemAt(i)
      item.visible = particle !== undefined
      if (!particle) continue
      item.text = particle.text
      item.color = colors[particle.role]
      item.x = Math.round(particle.x - item.width / 2)
      item.y = Math.round(particle.y - item.height / 2)
      item.opacity = Math.min(1, particle.life * 2)
    }
    flash.opacity = effects.flash * flashOpacity
    glitch.strength = fullEffects ? effects.glitch : 0
    glitch.sync(effects.slices)
  }

  function syncMessages() {
    const toast = run.toast
    toastBox.visible = toast !== null
    if (toast) {
      toastText.text = toast.text
      toastText.color = colors[toast.role]
      toastBox.opacity = Math.min(1, (Run.TOAST_SECONDS - toast.age) * 2)
    }
    const shown = run.popups.slice(-popupPoolSize)
    for (let i = 0; i < popupPoolSize; i++) {
      const item = popups.itemAt(i)
      const popup = shown[i]
      item.visible = popup !== undefined
      if (!popup) continue
      item.text = popup.text
      item.note = popup.note
      item.role = popup.role
      item.x = Math.round(popup.x - item.width / 2)
      item.y = Math.round(popup.y - item.height - popup.age * popupRise)
      item.opacity = Math.min(1, (Run.POPUP_SECONDS - popup.age) * 1.5)
    }
  }

  function syncHud() {
    hudLeft = run.levelNumber > Run.LEVEL_COUNT ? "BOSS" : "LVL " + run.levelNumber + "/" + Run.LEVEL_COUNT
    hudRight = "bits " + pad(Run.runBits(run), 3) + "   score " + pad(run.score, 5) + "   " + pad(world.time.toFixed(1), 4) + "s"
    hudLives = "@ x" + run.lives
    livesGained = run.livesFlash > 0
    livesFlashing = livesGained && Math.floor(run.livesFlash * 8) % 2 === 0
  }

  function sync() {
    const cameraX = Math.round(world.cameraX)
    levelLayer.x = -cameraX
    dynamicLayer.x = -cameraX
    farStrip.cameraX = cameraX
    nearStrip.cameraX = cameraX
    syncHero()
    for (let i = 0; i < bits.count; i++) {
      const item = bits.itemAt(i)
      item.visible = !world.bits[i].collected
      item.y = item.restY + Math.sin(world.time * 3 + item.x) * 3
    }
    for (let i = 0; i < enemies.count; i++) enemies.itemAt(i).sync(world.enemies[i], world.time)
    boss.sync(world.boss, world.time)
    checkpointLit = world.checkpointReached
    finished = world.finished && !run.won
    over = run.over
    overCause = run.over ? run.cause + " · " + stageName() : ""
    syncHud()
    syncMessages()
    syncEffects()
  }

  Item {
    id: stage
    width: Screen.SCREEN_WIDTH
    height: Screen.SCREEN_HEIGHT
    x: (view.width - width * view.gameScale) / 2
    y: (view.height - height * view.gameScale) / 2
    scale: view.gameScale
    transformOrigin: Item.TopLeft
    clip: true

    Rectangle {
      anchors.fill: parent
      color: view.colors.background
    }

    Item {
      id: scene
      anchors.fill: parent

      HexStrip {
        id: farStrip
        glyphs: view.backdrop.far
        parallax: BackdropLogic.FAR_PARALLAX
        size: 11
        color: view.colors.hexdump
        opacity: 0.12
        texelScale: view.texelScale
      }

      HexStrip {
        id: nearStrip
        glyphs: view.backdrop.near
        parallax: BackdropLogic.NEAR_PARALLAX
        size: 12
        color: view.colors.hexdump
        opacity: 0.2
        texelScale: view.texelScale
      }

      Item {
        id: shaken
        width: Screen.SCREEN_WIDTH
        height: Screen.SCREEN_HEIGHT

        Item {
          id: levelLayer

          Repeater {
            model: view.sections

            Item {
              id: section
              required property var modelData
              readonly property size textureSize: Qt.size(width * view.texelScale, height * view.texelScale)
              x: modelData.x
              width: Level.SECTION_WIDTH + Level.SECTION_OVERHANG
              height: Screen.SCREEN_HEIGHT
              layer.enabled: true
              layer.textureSize: textureSize

              GlowLayer {
                width: section.width
                height: section.height
                glowing: view.fullEffects
                glow: 0.4
                glowOpacity: 0.2
                textureSize: section.textureSize

                Repeater {
                  model: section.modelData.glyphs.filter(glyph => glyph.role !== "muted")

                  Glyph {
                    required property var modelData
                    x: modelData.x
                    y: modelData.y
                    text: modelData.text
                    size: modelData.size
                    color: view.colors[modelData.role]
                  }
                }
              }

              Repeater {
                model: section.modelData.glyphs.filter(glyph => glyph.role === "muted")

                Glyph {
                  required property var modelData
                  x: modelData.x
                  y: modelData.y
                  text: modelData.text
                  size: modelData.size
                  color: view.colors.muted
                }
              }
            }
          }
        }

        GlowLayer {
          width: Screen.SCREEN_WIDTH
          height: Screen.SCREEN_HEIGHT
          glowing: view.fullEffects
          glow: 0.4
          glowOpacity: 0.35
          textureSize: view.screenTexture

          Item {
            id: dynamicLayer

            Repeater {
              id: bits
              model: view.world.bits

              Glyph {
                required property var modelData
                readonly property real restY: (modelData.row + 0.5) * Screen.TILE - height / 2
                x: (modelData.col + 0.5) * Screen.TILE - width / 2
                y: restY
                text: modelData.text
                size: 20
                color: view.colors.bit
              }
            }

            Repeater {
              model: view.world.level.checkpoint ? Level.checkpointGlyphs(view.world.level.checkpoint, view.checkpointLit) : []

              Glyph {
                required property var modelData
                x: modelData.x
                y: modelData.y
                text: modelData.text
                size: modelData.size
                color: view.colors[modelData.role]
              }
            }

            Repeater {
              id: enemies
              model: view.world.enemies

              Enemy {
                required property var modelData
                enemy: modelData
                colors: view.colors
              }
            }

            Boss {
              id: boss
              colors: view.colors
            }

            Glyph {
              id: trail
              size: 14
              opacity: 0.7
              color: view.colors.muted
            }

            HeroFigure {
              id: hero
              colors: view.colors
            }

            Repeater {
              id: popups
              model: view.popupPoolSize

              Column {
                property alias text: score.text
                property alias note: note.text
                property string role: "bit"
                visible: false

                Glyph {
                  id: score
                  anchors.horizontalCenter: parent.horizontalCenter
                  size: 14
                  color: view.colors[parent.role]
                }

                Glyph {
                  id: note
                  anchors.horizontalCenter: parent.horizontalCenter
                  visible: text !== ""
                  size: 11
                  opacity: 0.75
                  color: view.colors[parent.role]
                }
              }
            }

            Repeater {
              id: particles
              model: Effects.PARTICLE_LIMIT

              Glyph {
                visible: false
                size: 14
              }
            }
          }
        }
      }
    }

    Glitch {
      id: glitch
      anchors.fill: parent
      source: scene
      textureSize: view.screenTexture
      sliceCount: Effects.GLITCH_SLICES
    }

    Rectangle {
      id: flash
      anchors.fill: parent
      color: view.colors.text
      opacity: 0
      visible: opacity > 0
    }

    Rectangle {
      x: 16
      y: 14
      width: hudLevel.width + 16
      height: 26
      color: view.colors.muted
      opacity: 0.35
    }

    Glyph {
      id: hudLevel
      x: 24
      y: 17
      text: view.hudLeft
      size: 14
      color: view.colors.bit
    }

    Glyph {
      x: 118
      y: 17
      text: "seed " + Seed.formatSeed(view.run.seed)
      size: 14
      color: view.colors.text
    }

    Glyph {
      anchors.right: hudLivesText.left
      anchors.rightMargin: 14
      y: 17
      text: view.hudRight
      size: 14
      color: view.colors.text
    }

    Glyph {
      id: hudLivesText
      anchors.right: parent.right
      anchors.rightMargin: 20
      y: 17
      text: view.hudLives
      size: 14
      scale: view.livesGained ? 1.25 : 1
      color: view.livesFlashing ? view.colors.hero : view.colors.text
    }

    Rectangle {
      id: toastBox
      z: 1
      anchors.horizontalCenter: parent.horizontalCenter
      y: 64
      width: Math.max(300, toastText.width + 40)
      height: 34
      visible: false
      color: Qt.alpha(view.colors.background, 0.85)

      Glyph {
        id: toastText
        anchors.centerIn: parent
        size: 16
      }
    }

    Loader {
      anchors.fill: parent
      active: view.finished

      sourceComponent: LevelSummary {
        run: view.run
        time: view.summaryTime
        ready: view.summaryReady
        colors: view.colors
      }
    }

    Loader {
      anchors.fill: parent
      active: view.over

      sourceComponent: GameOver {
        run: view.run
        cause: view.overCause
        rank: view.rank
        items: view.overItems
        index: view.menuIndex
        colors: view.colors
      }
    }

    GameMenu {
      anchors.fill: parent
      visible: view.menuOpen
      items: view.menuItems
      index: view.menuIndex
      colors: view.colors
    }

    Rectangle {
      anchors.fill: parent
      visible: view.paused
      color: Qt.rgba(0, 0, 0, 0.6)

      Glyph {
        anchors.centerIn: parent
        text: "[ PAUSED ]"
        size: 28
        color: view.colors.text
      }
    }
  }

  Component.onCompleted: sync()
}
