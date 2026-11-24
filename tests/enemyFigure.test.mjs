import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEATH_SECONDS,
  FORK_TEAR_SECONDS,
  ZOMBIE_DEATH_SECONDS,
  bossDeaths,
  columnParts,
  columnRows,
  createEnemyAnimator,
  deathFigure,
  deathOf,
  deathSeconds,
  deathSparks,
  drawnNear,
  enemyFigure,
  glitching,
  partCount,
  puddleParts,
  puddleShown,
  shotParts,
  stepEnemyAnimator,
} from "../logic/enemyFigure.mjs";
import { createEnemies, createEnemy, stepEnemies, POINTER_PERIOD, POINTER_WARNING_SECONDS } from "../logic/enemies.mjs";
import { parseLevel } from "../logic/level.mjs";
import { createHero } from "../logic/physics.mjs";
import { SCREEN_WIDTH, TILE } from "../logic/screen.mjs";

const KINDS = ["bug", "zombie", "spikes", "ping", "hang", "cron", "pipe", "pointer", "fork", "leak", "spinlock"];
const CREATURES = ["bug", "zombie", "ping", "hang", "fork", "leak"];
const TIMES = [0, 0.37, 1.3, 2.61, 3.05, 5.5];

function enemyOf(kind, extra) {
  const enemy = createEnemy(Object.assign({ kind, col: 5, row: 20, tiles: kind === "spikes" ? 2 : 1, extent: 7, arm: 4 }, extra || {}));
  enemy.id = 0;
  return enemy;
}

function flatLevel() {
  const rows = [];
  for (let i = 0; i < 21; i++) rows.push(".".repeat(20));
  rows.push("#".repeat(20));
  return parseLevel(rows);
}

function spinning(extra) {
  const enemy = enemyOf("spinlock", Object.assign({ row: 15 }, extra || {}));
  stepEnemies([enemy], flatLevel(), createHero(0, 21 * TILE), 0.5);
  return enemy;
}

function shown(parts) {
  return parts.filter(p => p.text !== "" && p.opacity > 0);
}

function spanX(parts) {
  return { left: Math.min(...parts.map(p => p.x - p.width / 2)), right: Math.max(...parts.map(p => p.x + p.width / 2)) };
}

test("every enemy is drawn with the same number of parts in every state and moment", () => {
  for (const kind of KINDS) {
    const enemy = kind === "spinlock" ? spinning() : enemyOf(kind);
    for (const time of TIMES) {
      for (const state of kind === "hang" ? ["hanging", "falling", "lying", "winding"] : [enemy.state]) {
        enemy.state = state;
        enemy.time = time;
        assert.equal(enemyFigure(enemy, time, true).parts.length, partCount(enemy), `${kind} ${state} at ${time}`);
      }
    }
  }
});

test("animating an enemy never changes it", () => {
  for (const kind of KINDS) {
    const enemy = kind === "spinlock" ? spinning() : enemyOf(kind);
    const before = JSON.stringify(enemy);

    for (const time of TIMES) {
      enemyFigure(enemy, time, true);
      deathFigure(enemy, time, 0.3);
    }

    assert.equal(JSON.stringify(enemy), before, kind);
  }
});

test("a creature walking left is the mirror of one walking right", () => {
  const right = enemyOf("bug");
  right.direction = 1;
  const left = enemyOf("bug");
  left.direction = -1;

  const rightParts = enemyFigure(right, 1, false).parts;
  const leftParts = enemyFigure(left, 1, false).parts;

  rightParts.forEach((p, i) => {
    assert.equal(leftParts[i].x + 0, -p.x + 0);
    assert.equal(leftParts[i].rotation + 0, -p.rotation + 0);
  });
});

test("creatures have eyes in the foreground colour that glare inwards", () => {
  for (const kind of ["ping", "hang"]) {
    const eyes = enemyFigure(enemyOf(kind), 1, false).parts.filter(p => p.role === "text");

    assert.equal(eyes.length, 2, kind);
    const [left, right] = eyes[0].x < eyes[1].x ? eyes : [eyes[1], eyes[0]];
    assert.ok(left.rotation > 0 && right.rotation < 0, kind);
  }
});

test("traps have no eyes and only red parts", () => {
  for (const kind of ["spikes", "cron", "pipe", "pointer", "spinlock"]) {
    const enemy = kind === "spinlock" ? spinning() : enemyOf(kind);
    const roles = shown(enemyFigure(enemy, 1, true).parts).map(p => p.role);

    assert.ok(roles.every(role => role.startsWith("hostile")), kind);
  }
});

test("spikes are drawn exactly to their hitbox", () => {
  for (const tiles of [1, 2, 4]) {
    const enemy = enemyOf("spikes", { tiles });

    const parts = enemyFigure(enemy, 1, false).parts;

    const span = spanX(parts.map(p => Object.assign({}, p, { width: p.width / 0.85 })));
    assert.ok(Math.abs(span.left + enemy.width / 2) < 1e-9 && Math.abs(span.right - enemy.width / 2) < 1e-9, `${tiles} tiles`);
    assert.ok(parts.every(p => p.height === enemy.height && p.y === -enemy.height / 2));
  }
});

test("the cron column fills its hitbox", () => {
  const enemy = enemyOf("cron", { height: 6 });

  const rows = columnParts(enemy, 1);

  assert.equal(rows.length, columnRows(enemy));
  const top = Math.min(...rows.map(p => p.y - (p.height + 1) / 2));
  assert.equal(top, -enemy.columnTiles * TILE);
  assert.ok(rows.every(p => p.width === enemy.width));
});

test("the pipe daemon's head reaches the top of its hitbox and stays inside its width", () => {
  const enemy = enemyOf("pipe");

  const parts = enemyFigure(enemy, 1, false).parts;

  const head = parts.slice(1);
  assert.equal(Math.min(...head.map(p => p.y - p.height / 2)), -enemy.height);
  const span = spanX(head);
  assert.ok(span.left >= -enemy.width / 2 && span.right <= enemy.width / 2);
});

test("a pointer shot is drawn over its 24 pixel hitbox", () => {
  const parts = shotParts(100, 50, 1);

  const span = spanX(parts);

  assert.equal(span.left, 100);
  assert.ok(Math.abs(span.right - 124) < 1);
  assert.ok(parts.every(p => p.height <= 7));
});

test("the pointer swells and spins faster only while it warns", () => {
  const enemy = enemyOf("pointer");
  enemy.charge = 0;
  const calm = enemyFigure(enemy, 1, false).parts[2];
  enemy.charge = POINTER_PERIOD - POINTER_WARNING_SECONDS / 2;

  const warning = enemyFigure(enemy, 1, false).parts[2];

  assert.ok(warning.height > calm.height);
});

test("the puddle is drawn across the whole frame so the clip reveals how far it has grown", () => {
  const parts = puddleParts(7, 1);

  assert.ok(parts.every(p => p.width === 7 * TILE && p.x === 0));
  assert.ok(Math.max(...parts.map(p => p.y + p.height / 2)) <= 0);
});

test("spinlock links are drawn at their positions and hidden behind the ground", () => {
  const enemy = spinning({ double: true });
  enemy.links[1].buried = true;

  const links = enemyFigure(enemy, 1, false).parts.slice(4);

  assert.equal(links[1].opacity, 0);
  assert.equal(links[0].x, enemy.links[0].x - enemy.x);
  assert.equal(links[0].y, enemy.links[0].y - enemy.y);
  assert.equal(links[enemy.arm - 1].text, "✶");
});

test("idle loops of the hang, cron vent and pipe ignore their own timers so they never hint at the next action", () => {
  for (const kind of ["hang", "cron", "pipe"]) {
    const early = enemyOf(kind);
    const late = enemyOf(kind);
    late.time = 2.3;
    late.timer = 1.7;
    late.phase = 0.9;

    assert.deepEqual(enemyFigure(early, 4.2, false), enemyFigure(late, 4.2, false), kind);
  }
});

test("the glitch tick comes only with full effects and only to creatures", () => {
  const times = [];
  for (let t = 0; t < 4; t += 0.01) times.push(t);

  for (const kind of CREATURES) {
    assert.ok(times.some(t => glitching(kind, t, true)), kind);
    assert.ok(!times.some(t => glitching(kind, t, false)), kind);
  }
  for (const kind of ["spikes", "cron", "pipe", "pointer", "spinlock"]) assert.ok(!times.some(t => glitching(kind, t, true)), kind);
});

test("a glitching creature gets a cyan ghost of its body", () => {
  const time = [...Array(400).keys()].map(i => i / 100).find(t => glitching("bug", t, true));

  const parts = enemyFigure(enemyOf("bug"), time, true).parts;

  assert.equal(parts[parts.length - 1].role, "cyan");
  assert.equal(enemyFigure(enemyOf("bug"), time, false).parts[parts.length - 1].opacity, 0);
});

test("a ghost of a split fork bomb is drawn faint", () => {
  const enemy = enemyOf("fork");
  enemy.small = true;
  enemy.ghost = true;

  assert.ok(enemyFigure(enemy, 1, false).opacity < 1);
});

test("a stomp leaves a death that plays out and is then gone", () => {
  const enemies = createEnemies([{ kind: "bug", col: 3, row: 20 }]);
  const animator = createEnemyAnimator(enemies);
  enemies[0].alive = false;

  stepEnemyAnimator(animator, enemies, 0.1);

  assert.equal(deathOf(animator, 0).age, 0);
  stepEnemyAnimator(animator, enemies, DEATH_SECONDS / 2);
  assert.ok(deathOf(animator, 0) !== null);
  stepEnemyAnimator(animator, enemies, DEATH_SECONDS);
  assert.equal(deathOf(animator, 0), null);
});

test("an enemy that comes back alive drops its death", () => {
  const enemies = createEnemies([{ kind: "bug", col: 3, row: 20 }]);
  const animator = createEnemyAnimator(enemies);
  enemies[0].alive = false;
  stepEnemyAnimator(animator, enemies, 0.05);

  enemies[0].alive = true;
  stepEnemyAnimator(animator, enemies, 0.05);

  assert.equal(deathOf(animator, 0), null);
});

test("a stomped boss bug leaves a death although the boss drops it", () => {
  const bug = enemyOf("bug");
  const animator = createEnemyAnimator([]);
  stepEnemyAnimator(animator, [], 0.05, [bug]);
  bug.alive = false;

  stepEnemyAnimator(animator, [], 0.05, []);

  assert.equal(bossDeaths(animator).length, 1);
});

test("boss bugs cleared at the end of a core window vanish without a death", () => {
  const bug = enemyOf("bug");
  const animator = createEnemyAnimator([]);
  stepEnemyAnimator(animator, [], 0.05, [bug]);

  stepEnemyAnimator(animator, [], 0.05, []);

  assert.equal(bossDeaths(animator).length, 0);
});

test("a death squashes the body, then scrambles it into glitch glyphs that fade out", () => {
  const enemy = enemyOf("bug");

  const squashed = deathFigure(enemy, 1, DEATH_SECONDS * 0.3);
  const end = deathFigure(enemy, 1, DEATH_SECONDS);

  assert.ok(squashed.scaleY < 1 && squashed.scaleX > 1);
  assert.ok(shown(end.parts).length === 0);
  const scrambled = deathFigure(enemy, 1, DEATH_SECONDS * 0.8).parts.filter(p => p.text !== "");
  assert.ok(scrambled.every(p => "▓▒░#%&$!?".includes(p.text)));
});

test("a reaped zombie fades upwards", () => {
  const enemy = enemyOf("zombie");

  const half = deathFigure(enemy, 1, ZOMBIE_DEATH_SECONDS / 2);

  assert.ok(half.rise > 0 && half.opacity < 1);
  assert.equal(deathSeconds(enemy), ZOMBIE_DEATH_SECONDS);
  assert.equal(deathSparks(enemy, ZOMBIE_DEATH_SECONDS / 2).length, 0);
});

test("a big fork bomb tears sideways before its two small ones take over", () => {
  const enemy = enemyOf("fork");

  const torn = deathFigure(enemy, 1, FORK_TEAR_SECONDS);

  assert.ok(torn.scaleX > 2);
  assert.equal(deathSeconds(enemy), FORK_TEAR_SECONDS);
});

test("a killed leak's puddle dries away", () => {
  const enemy = enemyOf("leak");
  enemy.grown = 100;

  assert.equal(puddleShown(enemy, null), 100);
  assert.equal(puddleShown(enemy, DEATH_SECONDS / 2), 50);
  assert.equal(puddleShown(enemy, DEATH_SECONDS), 0);
});

test("a death scatters hex fragments once the squash is over", () => {
  const enemy = enemyOf("ping");

  assert.equal(deathSparks(enemy, 0.05).length, 0);
  assert.ok(deathSparks(enemy, DEATH_SECONDS * 0.7).every(spark => "0x7f3a9cde".includes(spark.text)));
});

test("only enemies near the screen are drawn, a pointer from a screen away so its shots fly in", () => {
  const bug = enemyOf("bug");
  const pointer = enemyOf("pointer");

  assert.ok(drawnNear(bug, bug.x - 100));
  assert.ok(!drawnNear(bug, bug.x + SCREEN_WIDTH));
  assert.ok(!drawnNear(bug, bug.x - 2 * SCREEN_WIDTH));
  assert.ok(drawnNear(pointer, pointer.x - 1.5 * SCREEN_WIDTH));
});
