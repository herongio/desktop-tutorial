import { chromium, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import type { RecordData } from "../src/rules";

const benchmark = JSON.parse(readFileSync("docs/benchmark.json", "utf8")) as {
  games: { moves: number[] }[];
};
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
const samples = [];
try {
  await page.goto(process.env.OMOK_BASE_URL || "http://127.0.0.1:5173");
  // Real bundled Worker reply, not just an HTTP or open-port check.
  await page.locator('[data-cell="112"]').click();
  await expect(page.locator(".cell.occupied")).toHaveCount(2);
  for (const [name, moves] of [
    ["opening", [112, 113, 97, 127]],
    ["middlegame", benchmark.games.at(-1)!.moves.slice(0, 20)],
  ] as const) {
    const record: RecordData = {
      version: 1,
      settings: {
        rule: "freestyle",
        mode: "local",
        difficulty: "expert",
        human: 1,
      },
      seed: 12345,
      moves: [...moves],
      elapsed: 0,
      createdAt: "2026-10-24T12:00:00.000Z",
      resigned: null,
    };
    await page
      .locator("#import-file")
      .setInputFiles({
        name: "performance.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(record)),
      });
    await page.locator("#dialog-ok").click();
    await expect(page.locator(".cell.occupied")).toHaveCount(moves.length);
    // Raw browser script avoids TS runtime name helpers crossing the context boundary.
    await page.evaluate(`(() => {
      const state = {
        frames: [],
        tasks: [],
        active: true,
        last: performance.now(),
      };
      const raf = (now) => {
        state.frames.push(now - state.last);
        state.last = now;
        if (state.active) requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
      const observer = new PerformanceObserver((list) =>
        state.tasks.push(...list.getEntries().map((e) => e.duration)),
      );
      observer.observe({ entryTypes: ["longtask"] });
      Object.assign(window, { omokPerf: state, omokObserver: observer });
    })()`);
    const start = performance.now();
    await page.locator("#hint").click();
    const clickStart = performance.now();
    await page.locator("#theme").click();
    const themeClickMs = performance.now() - clickStart;
    await expect(page.locator(".hinted")).toHaveCount(1);
    const endToEndMs = performance.now() - start;
    const stats = await page.evaluate(() => {
      const w = window as unknown as {
        omokPerf: { frames: number[]; tasks: number[]; active: boolean };
        omokObserver: PerformanceObserver;
      };
      w.omokPerf.active = false;
      w.omokObserver.disconnect();
      const p = window.performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      return {
        frameCount: w.omokPerf.frames.length,
        maxFrameGapMs: Math.max(0, ...w.omokPerf.frames),
        longTasks: w.omokPerf.tasks,
        usedJSHeapBytes: p.memory?.usedJSHeapSize ?? null,
      };
    });
    samples.push({
      name,
      plies: moves.length,
      endToEndMs,
      themeClickMs,
      hint: await page.locator("#hint-text").innerText(),
      ...stats,
    });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  writeFileSync(
    "docs/browser-performance.json",
    JSON.stringify(
      {
        browser: browser.version(),
        platform: process.platform,
        viewport: "1440x1100 headless Chromium",
        build: process.env.OMOK_BASE_URL?.includes("4173")
          ? "production preview"
          : "development",
        caveat:
          "One sample per position on a cloud CPU; frame gaps and automation click completion are not physical-device input-latency guarantees. Heap figures exclude Worker heaps.",
        bundledWorkerReply: "passed",
        errors,
        samples,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(samples, null, 2));
} finally {
  await browser.close();
}
