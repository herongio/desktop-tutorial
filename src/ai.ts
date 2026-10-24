import {
  CELLS,
  DIRECTIONS,
  SIZE,
  inside,
  other,
  winningLine,
  type Difficulty,
  type Game,
  type Player,
  type Rule,
} from "./rules";

export const LEVELS = {
  intro: { label: "입문", timeMs: 65, maxDepth: 1, width: 6 },
  club: { label: "균형", timeMs: 350, maxDepth: 3, width: 10 },
  expert: { label: "도전", timeMs: 1200, maxDepth: 5, width: 14 },
} as const;
export interface Analysis {
  index: number;
  reason: "win" | "block" | "threat" | "position";
  score: number;
  depth: number;
  nodes: number;
  elapsed: number;
  limited: boolean;
}
export interface SearchOptions {
  timeMs?: number;
  maxDepth?: number;
  nodeLimit?: number;
  seed?: number;
}
const MATE = 10000000;
const TIMEOUT = Symbol("budget");

export function winningMoves(
  board: number[],
  player: Player,
  rule: Rule,
): number[] {
  const result: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (board[i]) continue;
    board[i] = player;
    const wins = winningLine(board, i, rule).length > 0;
    board[i] = 0;
    if (wins) result.push(i);
  }
  return result;
}

/** Independent, deterministic shape heuristic. Values are NOT win probabilities. */
export function potential(
  board: number[],
  index: number,
  player: Player,
): number {
  const x = index % SIZE,
    y = Math.floor(index / SIZE);
  let total = 0,
    threats = 0;
  for (const [dx, dy] of DIRECTIONS) {
    const line: number[] = [];
    for (let n = -5; n <= 5; n++) {
      const xx = x + n * dx,
        yy = y + n * dy;
      line.push(n === 0 ? player : inside(xx, yy) ? board[yy * SIZE + xx] : 3);
    }
    let best = 0;
    for (let start = 1; start <= 5; start++) {
      const window = line.slice(start, start + 5);
      if (window.some((v) => v !== 0 && v !== player)) continue;
      const count = window.filter((v) => v === player).length;
      const opens =
        Number(line[start - 1] === 0) + Number(line[start + 5] === 0);
      const value = [0, 2, 15, 160, 3500, 200000][count] * (1 + opens * 0.55);
      best = Math.max(best, value);
    }
    if (best >= 3500) threats++;
    total += best;
  }
  return total + (threats >= 2 ? 18000 : 0);
}

function candidates(
  board: number[],
  player: Player,
  width: number,
  seed: number,
): number[] {
  const nearby = new Set<number>();
  for (let i = 0; i < CELLS; i++)
    if (board[i]) {
      const x = i % SIZE,
        y = Math.floor(i / SIZE);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx,
            yy = y + dy,
            j = yy * SIZE + xx;
          if (inside(xx, yy) && !board[j]) nearby.add(j);
        }
    }
  if (!nearby.size) return board.some(Boolean) ? [] : [112, 111, 113, 97, 127];
  const tie = (i: number) =>
    ((((i + 1) * 2654435761) ^ seed) >>> 0) / 4294967296;
  return [...nearby]
    .map((index) => ({
      index,
      value:
        potential(board, index, player) +
        potential(board, index, other(player)) * 1.08 +
        tie(index),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, width)
    .map((v) => v.index);
}

function evaluate(board: number[], player: Player): number {
  let score = 0;
  const weights = [0, 1, 12, 140, 3200, 200000];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      for (const [dx, dy] of DIRECTIONS) {
        if (!inside(x + dx * 4, y + dy * 4)) continue;
        let own = 0,
          foe = 0;
        for (let n = 0; n < 5; n++) {
          const v = board[(y + dy * n) * SIZE + x + dx * n];
          if (v === player) own++;
          else if (v) foe++;
        }
        if (!foe) score += weights[own];
        if (!own) score -= weights[foe];
      }
    }
  return score;
}

export function chooseMove(
  game: Game,
  difficulty: Difficulty,
  options: SearchOptions = {},
): Analysis {
  const start = performance.now(),
    board = [...game.board],
    level = LEVELS[difficulty];
  const budget = options.timeMs ?? level.timeMs,
    maxDepth = options.maxDepth ?? level.maxDepth;
  const seed = options.seed ?? 1;
  let nodes = 0,
    limited = false,
    depthDone = 0;
  const finish = (
    index: number,
    reason: Analysis["reason"],
    score: number,
  ): Analysis => ({
    index,
    reason,
    score,
    nodes,
    depth: depthDone,
    elapsed: performance.now() - start,
    limited,
  });
  if (game.outcome || !board.includes(0)) return finish(-1, "position", 0);
  if (!board.some(Boolean))
    return finish([112, 111, 113, 97, 127][seed % 5], "position", 0);
  const wins = winningMoves(board, game.next, game.rule);
  if (wins.length) return finish(wins[seed % wins.length], "win", MATE);
  const blocks = winningMoves(board, other(game.next), game.rule);
  if (blocks.length)
    return finish(blocks[seed % blocks.length], "block", -MATE / 2);
  let order = candidates(board, game.next, level.width, seed);
  let best = order[0] ?? board.indexOf(0),
    bestScore = -Infinity;
  const check = () => {
    if (
      performance.now() - start >= budget ||
      nodes >= (options.nodeLimit ?? Infinity)
    )
      throw TIMEOUT;
  };
  type Entry = {
    depth: number;
    value: number;
    kind: "exact" | "lower" | "upper";
  };
  const cache = new Map<string, Entry>();
  const search = (
    player: Player,
    depth: number,
    alpha: number,
    beta: number,
    extension: number,
  ): number => {
    nodes++;
    check();
    // Full board identity avoids hash collisions; side, rule, and extension are explicit.
    const key = `${game.rule}:${player}:${extension}:${board.join("")}`;
    const entry = cache.get(key),
      originalAlpha = alpha,
      originalBeta = beta;
    if (entry && entry.depth >= depth) {
      if (entry.kind === "exact") return entry.value;
      if (entry.kind === "lower") alpha = Math.max(alpha, entry.value);
      else beta = Math.min(beta, entry.value);
      if (alpha >= beta) return entry.value;
    }
    const immediate = winningMoves(board, player, game.rule);
    if (immediate.length) return MATE + depth;
    const defense = winningMoves(board, other(player), game.rule);
    if (defense.length >= 2) return -MATE - depth;
    if (depth <= 0 && (!defense.length || extension <= 0))
      return evaluate(board, player);
    const moves = defense.length
      ? defense
      : candidates(board, player, level.width, seed);
    if (!moves.length) return 0;
    let value = -Infinity;
    for (const index of moves) {
      check();
      board[index] = player;
      let score: number;
      try {
        score = -search(
          other(player),
          depth - 1,
          -beta,
          -alpha,
          depth <= 0 ? extension - 1 : extension,
        );
      } finally {
        board[index] = 0;
      }
      value = Math.max(value, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    if (cache.size < 20000)
      cache.set(key, {
        depth,
        value,
        kind:
          value <= originalAlpha
            ? "upper"
            : value >= originalBeta
              ? "lower"
              : "exact",
      });
    return value;
  };
  for (let depth = 1; depth <= maxDepth; depth++) {
    let roundBest = best,
      roundScore = -Infinity;
    try {
      for (const index of order) {
        check();
        board[index] = game.next;
        let score: number;
        try {
          score = -search(
            other(game.next),
            depth - 1,
            -Infinity,
            -roundScore,
            2,
          );
        } finally {
          board[index] = 0;
        }
        if (score > roundScore) {
          roundScore = score;
          roundBest = index;
        }
      }
      best = roundBest;
      bestScore = roundScore;
      depthDone = depth;
      order = [best, ...order.filter((i) => i !== best)];
      if (bestScore >= MATE) break;
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      limited = true;
      break;
    }
  }
  return finish(
    best,
    potential(board, best, game.next) >= 3500 ? "threat" : "position",
    Number.isFinite(bestScore) ? bestScore : 0,
  );
}

export function explain(analysis: Analysis): string {
  if (analysis.reason === "win")
    return "이곳에 놓으면 현재 규칙에서 바로 승리합니다.";
  if (analysis.reason === "block")
    return "상대가 다음 수에 이길 수 있는 자리입니다. 이 위협을 먼저 막으세요. 다른 승리 자리도 있으면 한 수로 모두 막을 수는 없습니다.";
  if (analysis.reason === "threat")
    return "공격 위협을 만드는 후보입니다. 상대의 대응에 따라 달라지며 강제승리를 뜻하지 않습니다.";
  return "공격 가능성과 상대의 응수를 함께 고려한 후보입니다. 제한된 탐색의 추정이며 정답을 보장하지 않습니다.";
}
