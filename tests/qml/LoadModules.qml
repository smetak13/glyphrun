import QtQuick
import "../../logic/audio.mjs" as AudioLogic
import "../../logic/backdrop.mjs" as Backdrop
import "../../logic/boss.mjs" as Boss
import "../../logic/cells.mjs" as Cells
import "../../logic/bossFigure.mjs" as BossFigure
import "../../logic/chunks.mjs" as Chunks
import "../../logic/clock.mjs" as Clock
import "../../logic/effects.mjs" as Effects
import "../../logic/enemies.mjs" as Enemies
import "../../logic/enemyFigure.mjs" as EnemyFigure
import "../../logic/frameRate.mjs" as FrameRate
import "../../logic/heroFigure.mjs" as HeroFigure
import "../../logic/generator.mjs" as Generator
import "../../logic/highScores.mjs" as HighScores
import "../../logic/level.mjs" as Level
import "../../logic/menu.mjs" as Menu
import "../../logic/messages.mjs" as Messages
import "../../logic/physics.mjs" as Physics
import "../../logic/random.mjs" as Random
import "../../logic/run.mjs" as Run
import "../../logic/score.mjs" as Score
import "../../logic/screen.mjs" as Screen
import "../../logic/seed.mjs" as Seed
import "../../logic/story.mjs" as Story
import "../../logic/style.mjs" as Style
import "../../logic/terrain.mjs" as Terrain
import "../../logic/testLevel.mjs" as TestLevel
import "../../logic/theme.mjs" as Theme
import "../../logic/validator.mjs" as Validator
import "../../logic/world.mjs" as World

QtObject {
  Component.onCompleted: {
    try {
      const roles = { foreground: "#ffffff", background: "#000000", accent: "#888888", urgent: "#ff0000", muted: "#444444" }
      Theme.gameColors(Theme.buildPalette("red = \"#c34043\"\ncolor2 = \"#76946a\"", roles))
      const level = Level.parseLevel(TestLevel.TEST_LEVEL)
      const style = Style.levelStyle(0x7f3a91c2, 1)
      Level.levelSections(level, style.terrain)
      const world = World.createWorld(level)
      const clock = Clock.createClock()
      const input = { direction: 1, jumpHeld: true, jumpPressed: true }
      for (let i = 0; i < Clock.stepsFor(clock, 1 / 60); i++) World.stepWorld(world, input, Clock.STEP_SECONDS)
      const run = Run.createRun(0x7f3a91c2, level)
      Run.stepRun(run, input, Clock.STEP_SECONDS)
      Run.hitHero(run, Messages.ENEMY_SOURCES[0])
      Run.killEnemy(run, Messages.KILLABLE_SOURCES[0], 0, 0, false)
      Score.timeBonus(10, 60)
      Enemies.pingHeight(1)
      Level.checkpointGlyphs(level.checkpoint, world.checkpointReached)
      const envelope = Physics.computeEnvelope()
      const generated = Generator.generateLevel(Seed.parseSeed("7f3a-91c2"), 2, 0)
      Level.levelSections(generated, style.terrain)
      for (const family of Terrain.TERRAIN_FAMILIES) Level.levelSections(generated, Terrain.buildTerrain(family, Random.createRandom(3)))
      for (const family of Backdrop.BACKDROP_FAMILIES) Backdrop.buildBackdrop(family, Random.createRandom(3))
      Cells.mergeCells([])
      Validator.playableLevel(Seed.parseSeed("7f3a-91c2"), 5)
      const arena = World.createWorld(Boss.arenaLevel(0x7f3a91c2))
      for (let i = 0; i < 600; i++) World.stepWorld(arena, input, 1 / 60)
      Boss.phaseOrder(arena.level.seed, 10)
      const crowd = World.createWorld(generated)
      const animator = EnemyFigure.createEnemyAnimator(crowd.enemies)
      EnemyFigure.stepEnemyAnimator(animator, crowd.enemies, 1 / 60, [])
      for (const enemy of crowd.enemies) EnemyFigure.deathFigure(EnemyFigure.enemyFigure(enemy, 1, true) && enemy, 1, 0.3)
      BossFigure.faceLayers("angry", 1)
      Run.levelSummary(run)
      HighScores.insertScore(HighScores.parseScores("[]"), HighScores.scoreEntry(run, "2026-11-23"))
      Menu.mainMenuItems(run)
      Seed.typeSeed("7f3a", "9")
      Story.bootLog(run.stats, Run.runBits(run), Run.runSeconds(run))
      Story.sparkAt(Story.fireworks(run.seed)[0], 6)
      Story.victoryScene(9)
      Story.shippedShown(3)
      Story.commitHash(run.seed, 1)
      Random.shuffle(Random.subStream(1, "check"), Chunks.CHUNKS)
      AudioLogic.trackFor(run.seed, 6)
      Backdrop.backdropOffset(style.backdrop.near[0].x, Backdrop.NEAR_PARALLAX)
      const effects = Effects.createEffects()
      for (const cue of Run.takeCues(run)) Effects.applyCue(effects, cue)
      Effects.stepEffects(effects, 1 / 60)
      FrameRate.watchFrame(FrameRate.createFrameWatcher(), 1 / 60)
      Menu.stepVolume(0.5, 1)
      console.log("GLYPHRUN_MODULES_OK " + Seed.formatSeed(run.seed) + " " + run.score + " " + Screen.SCREEN_WIDTH + " " + world.hero.y + " " + envelope.maxGap + " " + generated.cols)
      Qt.exit(0)
    } catch (error) {
      console.log("GLYPHRUN_MODULES_FAILED " + error)
      Qt.exit(1)
    }
  }
}
