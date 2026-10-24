export const SIZE = 15;
export const CELLS = SIZE * SIZE;
export type Player = 1 | 2;
export type Rule = "freestyle" | "exact5";
export type Difficulty = "intro" | "club" | "expert";
export type Mode = "ai" | "local";
export interface Settings {
  rule: Rule;
  difficulty: Difficulty;
  human: Player;
  mode: Mode;
}
export interface Move {
  index: number;
  player: Player;
}
export interface Outcome {
  winner: Player | null;
  reason: "five" | "draw" | "resign";
  line: number[];
}
export interface Game {
  board: number[];
  moves: Move[];
  next: Player;
  rule: Rule;
  outcome: Outcome | null;
}
export interface RecordData {
  version: 1;
  settings: Settings;
  moves: number[];
  createdAt: string;
  elapsed: number;
  resigned: Player | null;
  seed: number;
}
export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;
export const other = (player: Player): Player => (player === 1 ? 2 : 1);
export const inside = (x: number, y: number) =>
  x >= 0 && x < SIZE && y >= 0 && y < SIZE;
export const coord = (index: number) =>
  `${String.fromCharCode(65 + (index % SIZE))}${SIZE - Math.floor(index / SIZE)}`;
export const emptyGame = (rule: Rule = "freestyle"): Game => ({
  board: Array(CELLS).fill(0),
  moves: [],
  next: 1,
  rule,
  outcome: null,
});

/** Check only lines through an existing stone; no UI or AI-specific rules. */
export function winningLine(
  board: readonly number[],
  index: number,
  rule: Rule,
): number[] {
  const player = board[index];
  if (!player) return [];
  const x = index % SIZE,
    y = Math.floor(index / SIZE);
  const result = new Set<number>();
  for (const [dx, dy] of DIRECTIONS) {
    const line = [index];
    for (const sign of [-1, 1]) {
      for (let n = 1; n < SIZE; n++) {
        const xx = x + n * dx * sign,
          yy = y + n * dy * sign;
        if (!inside(xx, yy) || board[yy * SIZE + xx] !== player) break;
        line.push(yy * SIZE + xx);
      }
    }
    if (rule === "freestyle" ? line.length >= 5 : line.length === 5)
      line.forEach((i) => result.add(i));
  }
  return [...result];
}

export function play(game: Game, index: number): Game {
  if (game.outcome) throw new Error("종료된 대국에는 착수할 수 없습니다.");
  if (!Number.isInteger(index) || index < 0 || index >= CELLS)
    throw new Error("보드 밖의 좌표입니다.");
  if (game.board[index]) throw new Error("이미 돌이 있는 자리입니다.");
  const board = [...game.board];
  board[index] = game.next;
  const moves = [...game.moves, { index, player: game.next }];
  const line = winningLine(board, index, game.rule);
  const outcome: Outcome | null = line.length
    ? { winner: game.next, reason: "five", line }
    : moves.length === CELLS
      ? { winner: null, reason: "draw", line: [] }
      : null;
  return { ...game, board, moves, outcome, next: other(game.next) };
}

export function replay(moves: readonly number[], rule: Rule): Game {
  return moves.reduce((game, index) => play(game, index), emptyGame(rule));
}

export function resign(game: Game, player: Player): Game {
  if (game.outcome) throw new Error("이미 종료된 대국입니다.");
  return {
    ...game,
    outcome: { winner: other(player), reason: "resign", line: [] },
  };
}

/** AI undo removes the human move plus its reply, or just a pending human move. */
export function undo(game: Game, settings: Settings): Game {
  let length = game.moves.length;
  if (settings.mode === "local") length = Math.max(0, length - 1);
  else {
    while (length > 0 && game.moves[length - 1].player !== settings.human)
      length--;
    if (length > 0) length--;
    else return game;
  }
  return replay(
    game.moves.slice(0, length).map((m) => m.index),
    game.rule,
  );
}

export function parseRecord(input: unknown): {
  record: RecordData;
  game: Game;
} {
  if (!input || typeof input !== "object")
    throw new Error("기보 형식이 올바르지 않습니다.");
  const r = input as RecordData;
  if (r.version !== 1) throw new Error("지원하지 않는 기보 버전입니다.");
  const s = r.settings;
  if (
    !s ||
    !["freestyle", "exact5"].includes(s.rule) ||
    !["intro", "club", "expert"].includes(s.difficulty) ||
    !["ai", "local"].includes(s.mode) ||
    ![1, 2].includes(s.human)
  )
    throw new Error("기보 설정이 올바르지 않습니다.");
  if (
    !Array.isArray(r.moves) ||
    r.moves.length > CELLS ||
    !r.moves.every(Number.isInteger)
  )
    throw new Error("착수 목록이 올바르지 않습니다.");
  if (
    !Number.isFinite(r.elapsed) ||
    r.elapsed < 0 ||
    r.elapsed > 315360000 ||
    !Number.isSafeInteger(r.seed) ||
    r.seed < 0 ||
    r.seed > 4294967295 ||
    typeof r.createdAt !== "string" ||
    !Number.isFinite(Date.parse(r.createdAt)) ||
    ![null, 1, 2].includes(r.resigned)
  )
    throw new Error("기보 메타데이터가 올바르지 않습니다.");
  let game = replay(r.moves, s.rule);
  if (r.resigned) game = resign(game, r.resigned);
  const record: RecordData = {
    version: 1,
    settings: {
      rule: s.rule,
      difficulty: s.difficulty,
      human: s.human,
      mode: s.mode,
    },
    moves: [...r.moves],
    createdAt: r.createdAt,
    elapsed: r.elapsed,
    seed: r.seed,
    resigned: r.resigned,
  };
  return { record, game };
}
