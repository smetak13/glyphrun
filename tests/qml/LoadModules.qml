import QtQuick
import "../../logic/chunks.mjs" as Chunks
import "../../logic/clock.mjs" as Clock
import "../../logic/enemies.mjs" as Enemies
import "../../logic/generator.mjs" as Generator
import "../../logic/level.mjs" as Level
import "../../logic/messages.mjs" as Messages
import "../../logic/physics.mjs" as Physics
import "../../logic/random.mjs" as Random
import "../../logic/run.mjs" as Run
import "../../logic/score.mjs" as Score
import "../../logic/screen.mjs" as Screen
import "../../logic/seed.mjs" as Seed
import "../../logic/testLevel.mjs" as TestLevel
import "../../logic/theme.mjs" as Theme
import "../../logic/world.mjs" as World

QtObject {
  Component.onCompleted: {
    try {
      const roles = { foreground: "#ffffff", background: "#000000", accent: "#888888", urgent: "#ff0000", muted: "#444444" }
      Theme.gameColors(Theme.buildPalette("red = \"#c34043\"\ncolor2 = \"#76946a\"", roles))
      const level = Level.parseLevel(TestLevel.TEST_LEVEL)
      Level.levelSections(level)
      const world = World.createWorld(level)
      const clock = Clock.createClock()
      const input = { direction: 1, jumpHeld: true, jumpPressed: true }
      for (let i = 0; i < Clock.stepsFor(clock, 1 / 60); i++) World.stepWorld(world, input, Clock.STEP_SECONDS)
      const run = Run.createRun(0x7f3a91c2, level)
      Run.stepRun(run, input, Clock.STEP_SECONDS)
      Run.hitHero(run, Messages.ENEMY_SOURCES[0])
      Run.killEnemy(run, Messages.KILLABLE_SOURCES[0], 0, 0, false)
      Score.timeBonus(10)
      Enemies.pingHeight(1)
      Level.checkpointGlyphs(level.checkpoint, world.checkpointReached)
      const envelope = Physics.computeEnvelope()
      const generated = Generator.generateLevel(Seed.parseSeed("7f3a-91c2"), 2, 0)
      Level.levelSections(generated)
      Random.shuffle(Random.subStream(1, "check"), Chunks.CHUNKS)
      console.log("GLYPHRUN_MODULES_OK " + Seed.formatSeed(run.seed) + " " + run.score + " " + Screen.SCREEN_WIDTH + " " + world.hero.y + " " + envelope.maxGap + " " + generated.cols)
      Qt.exit(0)
    } catch (error) {
      console.log("GLYPHRUN_MODULES_FAILED " + error)
      Qt.exit(1)
    }
  }
}
