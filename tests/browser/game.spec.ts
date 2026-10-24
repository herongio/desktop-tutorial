import { test, expect, type Page } from "@playwright/test";
import { parseRecord, type RecordData } from "../../src/rules";
import { chooseMove } from "../../src/ai";

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
const data = (moves: number[], extra = {}): RecordData => ({
  version: 1,
  settings: { rule: "freestyle", difficulty: "club", human: 1, mode: "local" },
  moves,
  seed: 42,
  elapsed: 30,
  createdAt: "2026-10-24T12:00:00.000Z",
  resigned: null,
  ...extra,
});
async function local(page: Page) {
  await page.goto("/");
  await page.locator('[data-mode="local"]').click();
  await page.locator("#new-game").click();
  await page.locator("#confirm-tap").uncheck();
}
async function load(page: Page, record: RecordData) {
  await page.goto("/");
  await page.locator("#import-file").setInputFiles({
    name: "fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(record)),
  });
  await expect
    .poll(async () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("omok.active.v1") || "{}").seed,
      ),
    )
    .toBe(record.seed);
  await page.locator("#confirm-tap").uncheck();
}
async function aiMatch(page: Page, touch = false) {
  await load(
    page,
    data([], {
      settings: { rule: "freestyle", difficulty: "club", human: 1, mode: "ai" },
    }),
  );
  if (touch) await page.locator("#confirm-tap").check();
  for (let turn = 0; turn < 113; turn++) {
    const record = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("omok.active.v1")!),
    );
    const game = parseRecord(record).game;
    if (game.outcome) break;
    expect(game.next).toBe(1);
    const move = chooseMove(game, "intro", {
      seed: 42 + game.moves.length,
      timeMs: 65,
    }).index;
    if (touch) {
      await cell(page, move).tap();
      await page.locator("#confirm-move").tap();
    } else await cell(page, move).click();
    await expect
      .poll(async () => {
        const r = await page.evaluate(() =>
          JSON.parse(localStorage.getItem("omok.active.v1")!),
        );
        const next = parseRecord(r).game;
        return (
          Boolean(next.outcome) || next.moves.length >= game.moves.length + 2
        );
      })
      .toBeTruthy();
  }
  const final = parseRecord(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("omok.active.v1")!),
    ),
  ).game;
  expect(final.outcome).not.toBeNull();
  await expect(page.locator(".cell.occupied")).toHaveCount(final.moves.length);
  return final;
}
test("desktop: full local game, result, terminal lock, undo and restart", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await local(page);
  for (const index of [0, 15, 1, 17, 2, 19, 3, 21, 4])
    await cell(page, index).click();
  await expect(page.locator("#status")).toHaveText("흑 승리!");
  await expect(page.locator(".cell.winning")).toHaveCount(5);
  await cell(page, 8).click({ force: true });
  await expect(page.locator(".cell.occupied")).toHaveCount(9);
  await page.locator("#undo").click();
  await expect(page.locator("#status")).toHaveText("흑의 차례입니다");
  await expect(page.locator(".cell.occupied")).toHaveCount(8);
  await page.locator("#new-game").click();
  await page.locator("#dialog-ok").click();
  await expect(page.locator(".cell.occupied")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("AI reply, cancel while computing, pause and resume, human white", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#difficulty").selectOption("expert");
  await page.locator("#new-game").click();
  await cell(page, 112).click();
  await page.locator("#undo").click();
  await page.waitForTimeout(1500);
  await expect(page.locator(".cell.occupied")).toHaveCount(0);
  await cell(page, 112).click();
  await page.locator("#pause").click();
  await page.waitForTimeout(1500);
  await expect(page.locator(".cell.occupied")).toHaveCount(1);
  await page.locator("#pause").click();
  await expect(page.locator(".cell.occupied")).toHaveCount(2);
  await page.locator("#human").selectOption("2");
  await page.locator("#difficulty").selectOption("intro");
  await page.locator("#new-game").click();
  await page.locator("#dialog-ok").click();
  await expect(page.locator(".cell.occupied")).toHaveCount(1);
  await expect(page.locator("#status")).toHaveText("백의 차례입니다");
});
test("AI takes a real winning move and completed game survives refresh", async ({
  page,
}) => {
  await load(
    page,
    data([0, 30, 1, 31, 2, 32, 3, 33], {
      settings: { rule: "freestyle", difficulty: "club", human: 2, mode: "ai" },
    }),
  );
  await expect(page.locator("#status")).toHaveText("흑 승리!");
  await expect(cell(page, 4)).toHaveClass(/black/);
  const saved = await page.evaluate(() =>
    localStorage.getItem("omok.active.v1"),
  );
  expect(JSON.parse(saved!).moves).toHaveLength(9);
  await page.reload();
  await expect(page.locator("#status")).toHaveText("흑 승리!");
});
test("autosave, history, review navigation and isolated branch", async ({
  page,
}) => {
  await local(page);
  for (const i of [112, 113, 97, 98]) await cell(page, i).click();
  await page.reload();
  await expect(page.locator(".cell.occupied")).toHaveCount(4);
  await page.locator("#review").click();
  await expect(page.locator(".cell.occupied")).toHaveCount(0);
  await page.locator('[data-review="next"]').click();
  await expect(page.locator(".cell.occupied")).toHaveCount(1);
  await page.locator("#branch-button").click();
  await cell(page, 0).click();
  await expect(page.locator(".cell.occupied")).toHaveCount(2);
  await page.locator("#exit-review").click();
  await expect(page.locator(".cell.occupied")).toHaveCount(4);
  await expect(cell(page, 0)).not.toHaveClass(/occupied/);
  await page.locator("#save").click();
  await page.locator('[data-tab="history"]').click();
  await expect(page.locator(".history-card")).toHaveCount(1);
  await page.locator(".history-card").click();
  await page.locator("#dialog-ok").click();
  await expect(page.locator("#review-count")).toContainText("0 / 4수");
});
test("export roundtrip and malformed import leave current board intact", async ({
  page,
}) => {
  await local(page);
  await cell(page, 112).click();
  await cell(page, 113).click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.locator("#new-game").click();
  await page.locator("#dialog-ok").click();
  await page.locator("#import-file").setInputFiles(path!);
  await expect(page.locator(".cell.occupied")).toHaveCount(2);
  await page.locator("#import-file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data([0, 0]))),
  });
  await expect(page.locator("#toast")).toContainText("가져오기 실패");
  await expect(page.locator(".cell.occupied")).toHaveCount(2);
});
test("keyboard, hints, practice and themes are functional", async ({
  page,
}) => {
  await local(page);
  await cell(page, 112).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(cell(page, 111)).toHaveClass(/occupied/);
  await page.locator("#hint").click();
  await expect(page.locator(".hinted")).toHaveCount(1);
  await expect(page.locator("#hint-text")).toContainText("추정");
  await page.locator("#theme").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "modern");
  await page.locator("#theme").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator('[data-tab="practice"]').click();
  await page.locator('[data-puzzle="0"]').click();
  await cell(page, 10).click();
  await expect(page.locator("#hint-text")).not.toContainText("정답입니다");
  await cell(page, 112).click();
  await expect(page.locator("#hint-text")).toContainText("정답입니다");
  await page.locator('[data-tab="play"]').click();
  await expect(page.locator(".cell.occupied")).toHaveCount(1);
});
test("Worker loading failure uses visible legal fallback", async ({ page }) => {
  await page.route("**/*ai.worker*", (route) => route.abort());
  await page.goto("/");
  await cell(page, 112).click();
  await expect(page.locator(".cell.occupied")).toHaveCount(2);
  await expect(page.locator("#toast")).toContainText("기본 전술 모드");
});
test("storage denial is reported without breaking play", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "QuotaExceededError");
    };
  });
  await local(page);
  await cell(page, 112).click();
  await expect(page.locator(".cell.occupied")).toHaveCount(1);
  await expect(page.locator("#toast")).toContainText("저장 공간");
});
test("exact-five setting is applied to new game and resignation blocks moves", async ({
  page,
}) => {
  await local(page);
  await page.locator("#rule").selectOption("exact5");
  await page.locator("#new-game").click();
  await expect(page.locator("#board-rule")).toContainText("EXACT FIVE");
  await cell(page, 0).click();
  await page.locator("#resign").click();
  await page.locator("#dialog-ok").click();
  await expect(page.locator("#status")).toHaveText("흑 승리!");
  await cell(page, 1).click({ force: true });
  await expect(page.locator(".cell.occupied")).toHaveCount(1);
});
test("desktop screenshot and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(page.locator("#status")).toHaveText("흑의 차례입니다");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/screenshots/desktop.png",
    fullPage: true,
  });
});
test("late engine response after new game and rule change is ignored", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class LateWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage() {
        setTimeout(
          () =>
            this.onmessage?.({
              data: {
                result: {
                  index: 14,
                  reason: "position",
                  score: 0,
                  depth: 1,
                  nodes: 1,
                  elapsed: 500,
                  limited: false,
                },
              },
            }),
          1000,
        );
      }
      terminate() {
        /* intentionally delivers a stale message despite termination */
      }
    }
    Object.defineProperty(window, "Worker", { value: LateWorker });
  });
  await page.goto("/");
  await cell(page, 112).click();
  await page.locator("#rule").selectOption("exact5");
  await page.locator("#new-game").click();
  await page.locator("#dialog-ok").click();
  await page.waitForTimeout(1200);
  await expect(page.locator(".cell.occupied")).toHaveCount(0);
  await expect(page.locator("#board-rule")).toContainText("EXACT FIVE");
});
test("double click makes one move, interrupted gesture makes none", async ({
  page,
}) => {
  await local(page);
  await cell(page, 112).dblclick();
  await expect(page.locator(".cell.occupied")).toHaveCount(1);
  await cell(page, 97).dispatchEvent("pointerdown", {
    isPrimary: true,
    clientX: 100,
    clientY: 100,
    pointerId: 1,
  });
  await cell(page, 97).dispatchEvent("pointermove", {
    isPrimary: true,
    clientX: 100,
    clientY: 150,
    pointerId: 1,
  });
  await cell(page, 97).dispatchEvent("click", { detail: 1 });
  await expect(page.locator(".cell.occupied")).toHaveCount(1);
});
test("complete desktop AI match through board inputs", async ({ page }) => {
  test.setTimeout(90000);
  const game = await aiMatch(page);
  await test.info().attach("completed-game.json", {
    body: JSON.stringify({ moves: game.moves, outcome: game.outcome }),
    contentType: "application/json",
  });
});
test("continuous-attack practice includes opponent defense and winning continuation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-tab="practice"]').click();
  await page.locator('[data-puzzle="3"]').click();
  await cell(page, 127).click();
  await expect(page.locator("#hint-text")).toContainText("백이");
  await expect(cell(page, 67)).toHaveClass(/white/);
  await cell(page, 142).click();
  await expect(page.locator("#hint-text")).toContainText("정답입니다");
});
test.describe("mobile touch", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("confirm placement, full game, rotation and mobile screenshot", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator('[data-mode="local"]').tap();
    await page.locator("#new-game").tap();
    await expect(page.locator("#confirm-tap")).toBeChecked();
    for (const i of [0, 15, 1, 17, 2, 19, 3, 21, 4]) {
      await cell(page, i).tap();
      await expect(cell(page, i)).not.toHaveClass(/occupied/);
      await page.locator("#confirm-move").tap();
    }
    await expect(page.locator("#status")).toHaveText("흑 승리!");
    await page.screenshot({
      path: "docs/screenshots/mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.locator("#new-game").tap();
    await page.setViewportSize({ width: 844, height: 390 });
    await cell(page, 224).tap();
    await page.locator("#confirm-move").tap();
    await expect(cell(page, 224)).toHaveClass(/black/);
  });
  test("complete mobile AI match through touch confirmation", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const game = await aiMatch(page, true);
    await test.info().attach("completed-mobile-game.json", {
      body: JSON.stringify({ moves: game.moves, outcome: game.outcome }),
      contentType: "application/json",
    });
  });
});
