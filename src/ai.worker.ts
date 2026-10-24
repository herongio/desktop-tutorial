import { chooseMove, type SearchOptions } from "./ai";
import type { Difficulty, Game } from "./rules";
self.onmessage = (
  event: MessageEvent<{
    game: Game;
    difficulty: Difficulty;
    options: SearchOptions;
  }>,
) => {
  try {
    self.postMessage({
      result: chooseMove(
        event.data.game,
        event.data.difficulty,
        event.data.options,
      ),
    });
  } catch {
    self.postMessage({ error: "AI 계산에 실패했습니다." });
  }
};
