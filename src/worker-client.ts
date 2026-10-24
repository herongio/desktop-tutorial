import { chooseMove, type Analysis, type SearchOptions } from "./ai";
import type { Difficulty, Game } from "./rules";

/** Termination plus generation token prevents every stale result from being applied. */
export class EngineClient {
  private worker: Worker | null = null;
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  cancel() {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    clearTimeout(this.timer);
  }
  run(
    game: Game,
    difficulty: Difficulty,
    options: SearchOptions,
    done: (result: Analysis, fallback: boolean) => void,
    failed: (message: string) => void,
  ) {
    this.cancel();
    const generation = this.generation;
    const fallback = () => {
      if (generation !== this.generation) return;
      this.worker?.terminate();
      this.worker = null;
      clearTimeout(this.timer);
      // Bounded one-ply fallback; never run a full search on the UI thread.
      this.timer = setTimeout(() => {
        if (generation !== this.generation) return;
        try {
          done(
            chooseMove(game, "intro", { ...options, maxDepth: 0, timeMs: 0 }),
            true,
          );
        } catch {
          failed(
            "AI를 실행하지 못했습니다. 다시 시도하거나 새 대국을 시작하세요.",
          );
        }
      }, 0);
    };
    try {
      this.worker = new Worker(new URL("./ai.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (
        event: MessageEvent<{ result?: Analysis; error?: string }>,
      ) => {
        if (generation !== this.generation) return;
        if (!event.data.result) {
          fallback();
          return;
        }
        this.worker?.terminate();
        this.worker = null;
        clearTimeout(this.timer);
        done(event.data.result, false);
      };
      this.worker.onerror = fallback;
      this.timer = setTimeout(fallback, 5000);
      this.worker.postMessage({ game, difficulty, options });
    } catch {
      fallback();
    }
  }
}
