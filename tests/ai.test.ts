import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseMove, winningMoves, LEVELS } from "../src/ai";
import { emptyGame, play, replay, type Difficulty } from "../src/rules";
import { puzzles } from "../src/puzzles";

for (const level of Object.keys(LEVELS) as Difficulty[]) {
  test(`${level}: takes immediate win before defending`, () => {
    const g = replay([0, 30, 1, 31, 2, 32, 3, 33], "freestyle");
    const result = chooseMove(g, level);
    assert.equal(result.index, 4);
    assert.equal(result.reason, "win");
    assert.equal(play(g, result.index).outcome?.winner, 1);
  });
  test(`${level}: blocks required defense at edge`, () => {
    const g = replay([105, 14, 107, 29, 109, 44, 111, 59], "freestyle");
    const result = chooseMove(g, level);
    assert.equal(result.index, 74);
    assert.equal(result.reason, "block");
  });
  test(`${level}: both colors use exact-five legality`, () => {
    const g = replay([0, 105, 2, 106, 4, 107, 6, 109, 8, 110, 10], "exact5");
    const result = chooseMove(g, level, { maxDepth: 1, timeMs: 300 });
    assert.equal(result.reason === "win", false);
    assert.equal(winningMoves([...g.board], 2, "exact5").includes(108), false);
  });
}
test("double-threat construction is found by reply search", () => {
  const g = puzzles[2].game;
  const r = chooseMove(g, "club", { timeMs: 2000, maxDepth: 2, seed: 8 });
  const next = play(g, r.index);
  assert.ok(
    winningMoves([...next.board], 1, g.rule).length >= 2,
    `selected ${r.index}`,
  );
});
test("every puzzle has a verified solution and accepts all valid coordinates", () => {
  for (const p of puzzles) {
    const answers: number[] = [];
    for (let i = 0; i < 225; i++)
      if (!p.game.board[i]) {
        const g = play(p.game, i);
        if (
          p.kind === "win"
            ? g.outcome?.winner === 1
            : p.kind === "block"
              ? winningMoves([...g.board], 2, g.rule).length === 0
              : winningMoves([...g.board], 1, g.rule).length >= 2
        )
          answers.push(i);
      }
    assert.ok(answers.length > 0, p.title);
    if (p.kind === "win") assert.ok(answers.length > 1);
  }
});
test("seeded fixed-depth search is reproducible and does not mutate board", () => {
  const g = replay([112, 113, 97, 127], "freestyle"),
    snapshot = structuredClone(g);
  const a = chooseMove(g, "club", { seed: 42, timeMs: 10000, maxDepth: 2 });
  const b = chooseMove(g, "club", { seed: 42, timeMs: 10000, maxDepth: 2 });
  assert.equal(a.index, b.index);
  assert.equal(a.score, b.score);
  assert.equal(a.depth, 2);
  assert.deepEqual(g, snapshot);
});
test("timeout uses legal fallback, node budget retains completed iteration", () => {
  const g = replay([112, 113, 97, 127], "freestyle");
  const immediate = chooseMove(g, "expert", { timeMs: 0 });
  assert.equal(immediate.limited, true);
  assert.equal(immediate.depth, 0);
  assert.equal(g.board[immediate.index], 0);
  const deep = chooseMove(g, "expert", { timeMs: 10000, nodeLimit: 100 });
  assert.equal(g.board[deep.index], 0);
  assert.ok(deep.depth >= 1);
  assert.equal(deep.limited, true);
});
test("opening variety is seeded and terminal positions yield no move", () => {
  const choices = new Set(
    Array.from(
      { length: 5 },
      (_, seed) => chooseMove(emptyGame(), "intro", { seed }).index,
    ),
  );
  assert.equal(choices.size, 5);
  const g = replay([0, 15, 1, 17, 2, 19, 3, 21, 4], "freestyle");
  assert.equal(chooseMove(g, "expert").index, -1);
});
test("difficulty limits are different and monotonically increase", () => {
  assert.ok(
    LEVELS.intro.maxDepth < LEVELS.club.maxDepth &&
      LEVELS.club.maxDepth < LEVELS.expert.maxDepth,
  );
  assert.ok(
    LEVELS.intro.timeMs < LEVELS.club.timeMs &&
      LEVELS.club.timeMs < LEVELS.expert.timeMs,
  );
});
test("sequence puzzle wins after every legal opponent response to the open four", () => {
  const puzzle = puzzles[3].game;
  const attack = play(puzzle, 127);
  for (let i = 0; i < 225; i++)
    if (!attack.board[i]) {
      const response = play(attack, i);
      assert.equal(response.outcome, null);
      const finish = chooseMove(response, "intro");
      assert.equal(finish.reason, "win");
      assert.equal(play(response, finish.index).outcome?.winner, 1);
    }
});
