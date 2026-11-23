import { test } from "node:test";
import assert from "node:assert/strict";
import { ENEMY_SOURCES, KILLABLE_SOURCES, bossHitMessage, hitMessage, killMessage } from "../logic/messages.mjs";

test("every enemy and trap has its own hit message", () => {
  const messages = ENEMY_SOURCES.map(hitMessage);

  assert.equal(ENEMY_SOURCES.length, 11);
  assert.equal(new Set(messages).size, 11);
});

test("hit messages name what the source does to software", () => {
  assert.equal(hitMessage("spikes"), "kernel: stack overflow");
  assert.equal(hitMessage("cron"), "cron: job executed (you)");
  assert.equal(hitMessage("spinlock"), "spinlock: deadlock detected");
  assert.equal(hitMessage("pit"), "/dev/null: write successful");
});

test("only enemies that can be stomped have kill messages", () => {
  assert.deepEqual(KILLABLE_SOURCES, ["bug", "zombie", "ping", "hang", "fork", "leak"]);
});

test("kill messages match the source", () => {
  assert.deepEqual(["bug", "zombie", "ping", "hang", "leak"].map(s => killMessage(s, false)), ["resolved", "reaped", "pong", "kill -9", "free()"]);
});

test("a big fork bomb is forked and a small one waited for", () => {
  assert.deepEqual([killMessage("fork", false), killMessage("fork", true)], ["forked", "wait()"]);
});

test("the boss's stack trace has its own hit message", () => {
  assert.equal(hitMessage("trace"), "Call Trace: you+0x0/0x1");
});

test("a boss hit says how many cores were dumped", () => {
  assert.deepEqual([1, 2, 3].map(hits => bossHitMessage(hits, 3)), ["core dumped (1/3)", "core dumped (2/3)", "core dumped (3/3)"]);
});
