import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CELLS,
  SIZE,
  emptyGame,
  play,
  replay,
  resign,
  undo,
  winningLine,
  parseRecord,
  type Player,
  type RecordData,
  type Settings,
} from "../src/rules";
const settings: Settings = {
  rule: "freestyle",
  difficulty: "club",
  human: 1,
  mode: "ai",
};
const data = (moves: number[]): RecordData => ({
  version: 1,
  settings,
  moves,
  seed: 42,
  elapsed: 12,
  createdAt: "2026-10-24T12:00:00.000Z",
  resigned: null,
});

for (const [name, line] of [
  ["top edge", [0, 1, 2, 3, 4]],
  ["bottom edge", [220, 221, 222, 223, 224]],
  ["left edge", [0, 15, 30, 45, 60]],
  ["right edge", [14, 29, 44, 59, 74]],
  ["descending diagonal", [0, 16, 32, 48, 64]],
  ["ascending diagonal", [14, 28, 42, 56, 70]],
] as const) {
  for (const player of [1, 2] as const)
    test(`winning direction: ${name}, player ${player}`, () => {
      const board = Array(CELLS).fill(0);
      for (const i of line) board[i] = player;
      assert.equal(winningLine(board, line[2], "freestyle").length, 5);
      assert.equal(winningLine(board, line[2], "exact5").length, 5);
    });
}
test("row boundaries never wrap into a winning line", () => {
  const b = Array(CELLS).fill(0);
  [12, 13, 14, 15, 16].forEach((i) => (b[i] = 1));
  assert.deepEqual(winningLine(b, 14, "freestyle"), []);
});
test("overline wins only in freestyle, for both colors", () => {
  for (const p of [1, 2]) {
    const b = Array(CELLS).fill(0);
    [105, 106, 107, 108, 109, 110].forEach((i) => (b[i] = p));
    assert.equal(winningLine(b, 108, "freestyle").length, 6);
    assert.equal(winningLine(b, 108, "exact5").length, 0);
  }
});
test("crossing exact five remains a win even with an overline in another direction", () => {
  const b = Array(CELLS).fill(0);
  [109, 110, 111, 112, 113, 114, 82, 97, 127, 142].forEach((i) => (b[i] = 1));
  assert.deepEqual(
    new Set(winningLine(b, 112, "exact5")),
    new Set([82, 97, 112, 127, 142]),
  );
  assert.equal(winningLine(b, 112, "freestyle").length, 10);
});
test("rejects occupied, fractional, out-of-board and terminal moves without mutation", () => {
  const g = play(emptyGame(), 112),
    snapshot = structuredClone(g);
  for (const i of [112, -1, 225, 1.2, NaN, Infinity])
    assert.throws(() => play(g, i));
  assert.deepEqual(g, snapshot);
  const won = replay([0, 15, 1, 17, 2, 19, 3, 21, 4], "freestyle");
  assert.equal(won.outcome?.winner, 1);
  assert.throws(() => play(won, 8));
  assert.throws(() => play(resign(g, 1), 8));
});
test("full legal board is a draw and can be replayed exactly", () => {
  const black: number[] = [],
    white: number[] = [];
  for (let i = 0; i < CELLS; i++)
    (((i % SIZE) + 2 * Math.floor(i / SIZE)) % 4 < 2 ? black : white).push(i);
  assert.equal(black.length, 113);
  assert.equal(white.length, 112);
  const moves = black.flatMap((n, i) =>
    white[i] === undefined ? [n] : [n, white[i]],
  );
  const g = replay(moves, "freestyle");
  assert.equal(g.outcome?.reason, "draw");
  assert.equal(g.moves.length, 225);
  assert.throws(() => play(g, 0));
});
test("win takes priority over draw on the final empty cell", () => {
  const g = emptyGame();
  for (let i = 0; i < CELLS; i++)
    g.board[i] = ((i % SIZE) + 2 * Math.floor(i / SIZE)) % 4 < 2 ? 1 : 2;
  for (let i = 0; i < 4; i++) g.board[i] = 1;
  g.board[4] = 0;
  g.board[5] = 2;
  g.moves = g.board.flatMap((p, index) =>
    p ? [{ index, player: p as Player }] : [],
  );
  const result = play(g, 4);
  assert.equal(result.outcome?.reason, "five");
  assert.equal(result.outcome?.winner, 1);
});
test("AI undo handles pending reply, completed turn, human white, and terminal state", () => {
  const g = replay([112, 113, 97, 98], "freestyle");
  assert.equal(undo(g, settings).moves.length, 2);
  assert.equal(
    undo(replay([112, 113, 97], "freestyle"), settings).moves.length,
    2,
  );
  assert.equal(undo(replay([112], "freestyle"), settings).moves.length, 0);
  const whiteSettings = { ...settings, human: 2 as const };
  assert.equal(
    undo(replay([112, 113, 97], "freestyle"), whiteSettings).moves.length,
    1,
  );
  assert.equal(undo(replay([112], "freestyle"), whiteSettings).moves.length, 1);
  const won = replay([0, 15, 1, 17, 2, 19, 3, 21, 4], "freestyle");
  const undone = undo(won, settings);
  assert.equal(undone.outcome, null);
  assert.equal(undone.next, 1);
  assert.equal(undo(g, { ...settings, mode: "local" }).moves.length, 3);
});
test("record roundtrip restores rule, settings, moves, and resignation", () => {
  const r = { ...data([112, 113]), resigned: 1 as const };
  const restored = parseRecord(JSON.parse(JSON.stringify(r)));
  assert.deepEqual(restored.record, r);
  assert.equal(restored.game.outcome?.winner, 2);
  assert.equal(
    parseRecord({ ...data([0, 15, 1, 17, 2, 19, 3, 21, 4]) }).game.outcome
      ?.winner,
    1,
  );
});
test("record import rejects malformed metadata, illegal moves, and moves after a win", () => {
  for (const r of [
    null,
    [],
    {},
    { ...data([]), version: 2 },
    data([1, 1]),
    data([-1]),
    data([225]),
    data([0.5]),
    data([0, 15, 1, 17, 2, 19, 3, 21, 4, 9]),
    { ...data([]), settings: { ...settings, rule: "renju" } },
    { ...data([]), elapsed: NaN },
    { ...data([]), seed: -1 },
    { ...data([]), createdAt: "<script>" },
    { ...data([]), resigned: 3 },
    { ...data([]), moves: Array(226).fill(1) },
  ])
    assert.throws(() => parseRecord(r));
});
test("branch simulation cannot change original game", () => {
  const source = replay([112, 113, 97, 98], "freestyle"),
    snapshot = structuredClone(source);
  const branch = play(
    replay(
      source.moves.slice(0, 2).map((m) => m.index),
      source.rule,
    ),
    96,
  );
  assert.equal(branch.moves.length, 3);
  assert.deepEqual(source, snapshot);
});
