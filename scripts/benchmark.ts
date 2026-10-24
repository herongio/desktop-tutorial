import { writeFileSync, mkdirSync } from "node:fs";
import { chooseMove } from "../src/ai";
import { other, play, replay, type Player } from "../src/rules";

// A controlled shallow-search baseline, NOT a historical released version.
const openings = [
  [112, 113],
  [97, 112],
  [96, 112, 98, 127],
];
const results = [];
const latencies: {
  engine: string;
  ply: number;
  ms: number;
  depth: number;
  nodes: number;
}[] = [];
const beforeMemory = process.memoryUsage().heapUsed;
for (let opening = 0; opening < openings.length; opening++) {
  for (const challengerColor of [1, 2] as Player[]) {
    let game = replay(openings[opening], "freestyle");
    while (!game.outcome) {
      const challenger = game.next === challengerColor;
      const result = chooseMove(game, challenger ? "club" : "intro", {
        timeMs: 80,
        maxDepth: challenger ? 3 : 1,
        seed: 700 + opening * 100 + game.moves.length,
      });
      latencies.push({
        engine: challenger ? "search" : "shallow",
        ply: game.moves.length,
        ms: result.elapsed,
        depth: result.depth,
        nodes: result.nodes,
      });
      game = play(game, result.index);
    }
    const outcome =
      game.outcome.winner === challengerColor
        ? "win"
        : game.outcome.winner === other(challengerColor)
          ? "loss"
          : "draw";
    results.push({
      opening,
      challengerColor,
      outcome,
      plies: game.moves.length,
      moves: game.moves.map((m) => m.index),
    });
    console.log(
      `opening=${opening} search=${challengerColor} ${outcome} plies=${game.moves.length}`,
    );
  }
}
const stats = (items: typeof latencies) => {
  const sorted = items.map((r) => r.ms).sort((a, b) => a - b);
  return {
    moves: items.length,
    averageMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    maxMs: sorted.at(-1),
    averageDepth: items.reduce((a, b) => a + b.depth, 0) / items.length,
  };
};
const wins = results.filter((r) => r.outcome === "win").length,
  n = results.length,
  z = 1.96;
const p = wins / n,
  denominator = 1 + (z * z) / n;
const center = (p + (z * z) / (2 * n)) / denominator;
const radius =
  (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
const report = {
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  protocol: {
    seeds: "700 + opening * 100 + ply",
    rule: "freestyle",
    perMoveBudgetMs: 80,
    baseline: "same implementation, intro width 6 / depth 1",
    challenger: "club width 10 / depth 3",
    caveat:
      "Six paired games are a smoke benchmark, not a rating or statistically reliable strength claim. Wall-time cutoffs depend on host load.",
  },
  wins,
  draws: results.filter((r) => r.outcome === "draw").length,
  losses: results.filter((r) => r.outcome === "loss").length,
  winFractionWilson95: [center - radius, center + radius],
  timing: {
    search: stats(latencies.filter((r) => r.engine === "search")),
    shallow: stats(latencies.filter((r) => r.engine === "shallow")),
    opening: stats(latencies.filter((r) => r.ply < 10)),
    middlegame: stats(latencies.filter((r) => r.ply >= 10)),
  },
  heapBeforeBytes: beforeMemory,
  heapAfterBytes: process.memoryUsage().heapUsed,
  games: results,
};
mkdirSync("docs", { recursive: true });
writeFileSync("docs/benchmark.json", JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      wins: report.wins,
      draws: report.draws,
      losses: report.losses,
      timing: report.timing,
      confidence: report.winFractionWilson95,
    },
    null,
    2,
  ),
);
