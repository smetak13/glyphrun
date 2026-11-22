import { test } from "node:test";
import assert from "node:assert/strict";
import { ENEMY_SOURCES, KILLABLE_SOURCES, hitMessage, killMessage } from "../logic/messages.mjs";

test("every enemy and trap has its own hit message", () => {
  const messages = ENEMY_SOURCES.map(hitMessage);

  assert.equal(ENEMY_SOURCES.length, 10);
  assert.equal(new Set(messages).size, 10);
});

test("hit messages name what the source does to software", () => {
  assert.equal(hitMessage("spikes"), "kernel: stack overflow");
  assert.equal(hitMessage("cron"), "cron: job executed (you)");
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
