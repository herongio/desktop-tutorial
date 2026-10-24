import "./style.css";
import {
  CELLS,
  SIZE,
  coord,
  emptyGame,
  other,
  parseRecord,
  play,
  replay,
  resign,
  undo,
  type Game,
  type Player,
  type RecordData,
  type Settings,
} from "./rules";
import { LEVELS, explain, winningMoves, type Analysis } from "./ai";
import { EngineClient } from "./worker-client";
import { puzzles } from "./puzzles";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const icons: Record<string, string> = {
  spark:
    '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/>',
  undo: '<path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  sound:
    '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
  book: '<path d="M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3V4Zm9 2v15"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  flag: '<path d="M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name] ?? ""}</svg>`;
const colorName = (p: Player) => (p === 1 ? "흑" : "백");
const ruleName = (r: Settings["rule"]) =>
  r === "freestyle" ? "자유 오목" : "정확히 5목";
const ruleHelp = (r: Settings["rule"]) =>
  r === "freestyle"
    ? "흑과 백 모두, 가로·세로·대각선으로 5개 이상 이으면 승리합니다."
    : "흑과 백 모두 정확히 5개를 이으면 승리합니다. 6개 이상은 승리가 아닙니다.";
const ACTIVE_KEY = "omok.active.v1",
  HISTORY_KEY = "omok.history.v1",
  PREFS_KEY = "omok.prefs.v1";
let settings: Settings = {
  rule: "freestyle",
  difficulty: "club",
  human: 1,
  mode: "ai",
};
let game = emptyGame(),
  createdAt = new Date().toISOString(),
  elapsed = 0,
  seed = randomSeed();
let paused = false,
  thinking = false,
  errorState = false,
  busyHint = false;
let selected = -1,
  keyboardIndex = 112,
  hint: Analysis | null = null,
  hintMessage = "";
let reviewCursor: number | null = null,
  branch: Game | null = null,
  practiceIndex: number | null = null;
let practiceGame: Game | null = null,
  practiceSolved = false;
let activeTab: "play" | "history" | "practice" = "play";
let sound = true,
  confirmTap = matchMedia("(pointer: coarse)").matches,
  theme = "wood";
let storageWarning = false,
  restored = false;
const ai = new EngineClient(),
  analyst = new EngineClient();
let audio: AudioContext | undefined;

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
function readJSON(key: string): unknown {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    storageWarning = true;
    return null;
  }
}
const saved = readJSON(ACTIVE_KEY);
if (saved) {
  try {
    const loaded = parseRecord(saved);
    game = loaded.game;
    settings = loaded.record.settings;
    elapsed = loaded.record.elapsed;
    createdAt = loaded.record.createdAt;
    seed = loaded.record.seed;
    restored = true;
  } catch {
    storageWarning = true;
  }
}
const prefs = readJSON(PREFS_KEY) as Record<string, unknown> | null;
if (prefs && typeof prefs === "object") {
  if (typeof prefs.sound === "boolean") sound = prefs.sound;
  if (typeof prefs.confirmTap === "boolean") confirmTap = prefs.confirmTap;
  if (
    typeof prefs.theme === "string" &&
    ["wood", "modern", "dark"].includes(prefs.theme)
  )
    theme = prefs.theme;
}

$("#app").innerHTML = `
  <header class="site-header"><a class="brand" href="#" aria-label="오목 홈"><span class="brand-mark"><i></i><i></i></span><b>오목</b><span class="brand-sub">OMOK STUDIO</span></a>
    <nav aria-label="주 메뉴"><button class="nav-button active" data-tab="play">대국</button><button class="nav-button" data-tab="history">대국 기록</button><button class="nav-button" data-tab="practice">연습실</button></nav>
    <div class="header-tools"><button id="sound" class="icon-button" aria-label="소리 끄기"></button><button id="theme" class="icon-button" aria-label="테마 변경">${icon("sun")}</button><button id="guide" class="icon-button" aria-label="도움말">${icon("book")}</button></div>
  </header>
  <main>
    <section class="intro"><div><div class="eyebrow"><span></span> A LITTLE PAUSE. A GOOD MOVE.</div><h1>한 수에, <em>온전히.</em></h1><p>가볍게 시작하고, 한 수씩 깊어지는 시간.</p></div><div class="intro-note">열다섯 줄 위의 작은 몰입<span>15 × 15 · PLAY & LEARN</span></div></section>
    <section id="history-page" class="collection" hidden><div class="section-title"><div><span class="eyebrow">YOUR GAMES</span><h2>다시 보면, 새로운 한 수.</h2></div><button class="secondary import-trigger">${icon("upload")} 기보 가져오기</button></div><p class="muted">이 브라우저에 최근 30개 대국을 보관합니다. 다른 기기에서는 기보 파일을 가져오세요.</p><div id="history-list"></div></section>
    <section id="practice-page" class="collection" hidden><span class="eyebrow">SMALL STEPS, BETTER MOVES</span><h2>오늘의 한 수를 찾아보세요.</h2><p class="muted">승리, 수비, 두 갈래 위협. 가능한 정답을 규칙 엔진으로 확인합니다.</p><div class="puzzle-list">${puzzles.map((p, i) => `<button class="puzzle-card" data-puzzle="${i}"><span class="puzzle-number">0${i + 1}</span><b>${p.title}</b><span>${["한 수 승리", "필수 방어", "복합 위협", "연속 공격"][i]}</span>${icon("chevron")}</button>`).join("")}</div></section>
    <section id="game-layout" class="game-layout">
      <div class="board-column">
        <div class="players"><div id="black-player" class="player"><span class="player-stone black"></span><div><b id="black-name"></b><span>흑돌 · 선공</span></div><span class="turn-tag">차례</span></div><span class="versus">vs</span><div id="white-player" class="player"><span class="player-stone white"></span><div><b id="white-name"></b><span>백돌 · 후공</span></div><span class="turn-tag">차례</span></div></div>
        <div class="board-frame"><div class="board-top"><span>OMOK</span><span id="board-rule">FREESTYLE · 15 × 15</span></div>
          <div class="board-wrap"><div class="axis axis-top">${Array.from({ length: SIZE }, (_, i) => `<span>${String.fromCharCode(65 + i)}</span>`).join("")}</div><div class="axis axis-left">${Array.from({ length: SIZE }, (_, i) => `<span>${SIZE - i}</span>`).join("")}</div>
          <div id="board" class="board" role="grid" aria-label="15 곱하기 15 오목판" aria-describedby="board-instructions"><svg class="board-lines" viewBox="0 0 450 450" aria-hidden="true">${Array.from({ length: SIZE }, (_, i) => `<path d="M${15 + i * 30} 15V435M15 ${15 + i * 30}H435"/>`).join("")}${[
            108, 112, 116, 48, 56, 168, 176,
          ]
            .filter((i) => i !== 108 && i !== 116)
            .map(
              (i) =>
                `<circle cx="${15 + (i % SIZE) * 30}" cy="${15 + Math.floor(i / SIZE) * 30}" r="3"/>`,
            )
            .join("")}</svg>${Array.from(
            { length: SIZE },
            (_, row) =>
              `<div class="board-row" role="row">${Array.from(
                { length: SIZE },
                (_, col) => {
                  const i = row * SIZE + col;
                  return `<button class="cell" data-cell="${i}" role="gridcell" tabindex="${i === 112 ? 0 : -1}" aria-label="${coord(i)} 빈 자리"><span class="stone"></span><span class="cell-marker"></span></button>`;
                },
              ).join("")}</div>`,
          ).join("")}</div></div>
          <div class="board-bottom"><span id="last-move">첫 수를 놓아보세요</span><span id="move-count">0수</span></div>
        </div>
        <div class="under-board"><span id="board-instructions">방향키로 이동 · Enter로 착수</span><label class="switch-label"><input id="confirm-tap" type="checkbox" ${confirmTap ? "checked" : ""}><span>착수 확인</span></label></div>
        <div id="selection-bar" class="selection-bar" hidden><span id="selection-text"></span><button id="confirm-move" class="primary">여기에 놓기</button><button id="cancel-selection" class="text-button">취소</button></div>
        <div id="review-bar" class="review-bar" hidden><button data-review="first" aria-label="처음으로">|‹</button><button data-review="prev" aria-label="이전 수">‹</button><span id="review-count"></span><button data-review="next" aria-label="다음 수">›</button><button data-review="last" aria-label="마지막으로">›|</button><button id="branch-button" class="text-button">다른 수 놓기</button><button id="exit-review" class="text-button">대국으로</button></div>
      </div>
      <aside class="sidebar">
        <section class="status-card"><div class="card-kicker"><span id="mode-label">AI와 대국</span><span class="live-dot"></span></div><h2 id="status" aria-live="polite"></h2><p id="status-help"></p><div class="game-meta"><span><small>진행 수</small><b id="meta-moves">0</b></span><span><small>대국 시간</small><b id="clock">00:00</b></span><span><small>난이도</small><b id="meta-level">균형</b></span></div><button id="new-game" class="primary full">${icon("plus")} 새 대국 시작</button><div class="quick-actions"><button id="undo">${icon("undo")} 무르기</button><button id="pause">Ⅱ 일시정지</button><button id="resign">${icon("flag")} 기권</button></div><button id="retry" class="secondary full" hidden>AI 다시 시도</button></section>
        <section class="settings-card"><div class="card-heading"><h3>나의 대국</h3><span>새 대국에 적용</span></div><div class="segmented"><button data-mode="ai">AI와 대국</button><button data-mode="local">친구와 둘이</button></div><label class="field"><span>AI 난이도</span><select id="difficulty"><option value="intro">입문 · 가볍게 배우기</option><option value="club">균형 · 한 수 더 생각하기</option><option value="expert">도전 · 깊이 탐색하기</option></select></label><label class="field"><span>나의 돌</span><select id="human"><option value="1">● 흑돌 · 먼저 두기</option><option value="2">○ 백돌 · 나중에 두기</option></select></label><label class="field"><span>게임 규칙</span><select id="rule"><option value="freestyle">자유 오목</option><option value="exact5">정확히 5목</option></select></label><p id="rule-description" class="rule-description"></p></section>
        <section class="hint-card"><div class="hint-heading"><span class="hint-icon">${icon("spark")}</span><h3>한 수의 발견</h3><span class="small-tag">LEARN</span></div><p id="hint-text">어디에 놓을지 고민되나요?<br>추천 수와 그 이유를 함께 살펴보세요.</p><button id="hint" class="hint-button">힌트 보기 ${icon("chevron")}</button></section>
      </aside>
    </section>
    <section id="moves-section" class="moves-section"><div class="card-heading"><h3>대국의 발자취 <span id="history-count">0수</span></h3><div><button id="review" class="text-button">${icon("book")} 복기</button><button id="save" class="text-button">기록 보관</button><button id="export" class="text-button">${icon("download")} 내보내기</button><button class="text-button import-trigger">${icon("upload")} 가져오기</button></div></div><div id="move-list" class="move-list"></div></section>
    <footer><span class="footer-brand">오목 <i>조용히, 한 수 더.</i></span><span>가입 없이 즐기세요 · 기보는 이 브라우저에 저장됩니다</span></footer>
  </main>
  <div id="toast" class="toast" role="status" hidden></div>
  <dialog id="dialog" aria-labelledby="dialog-title"><div id="dialog-content"></div></dialog>
  <input type="file" id="import-file" accept="application/json,.json" hidden>
`;

let draft = { ...settings };
const cells = [...document.querySelectorAll<HTMLButtonElement>("[data-cell]")];
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 5500);
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if (!storageWarning)
      toast(
        "브라우저 저장 공간을 사용할 수 없습니다. 기보를 파일로 내보내세요.",
      );
    storageWarning = true;
  }
}
function record(): RecordData {
  return {
    version: 1,
    settings: { ...settings },
    moves: game.moves.map((m) => m.index),
    createdAt,
    elapsed,
    seed,
    resigned:
      game.outcome?.reason === "resign" ? other(game.outcome.winner!) : null,
  };
}
function persist() {
  writeJSON(ACTIVE_KEY, record());
}
function savePrefs() {
  writeJSON(PREFS_KEY, { sound, confirmTap, theme });
}
function history(): RecordData[] {
  const data = readJSON(HISTORY_KEY);
  if (!Array.isArray(data)) return [];
  return data.slice(0, 30).flatMap((r) => {
    try {
      return [parseRecord(r).record];
    } catch {
      return [];
    }
  });
}
function archive() {
  if (!game.moves.length && !game.outcome) return;
  const data = record();
  writeJSON(
    HISTORY_KEY,
    [data, ...history().filter((r) => r.createdAt !== data.createdAt)].slice(
      0,
      30,
    ),
  );
}
function unlockAudio() {
  if (!sound || document.hidden) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume().catch(() => {});
  } catch {
    /* optional audio */
  }
}
function tone(finish = false) {
  if (!sound || document.hidden || !audio || audio.state !== "running") return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(finish ? 660 : 420, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    finish ? 880 : 180,
    audio.currentTime + 0.08,
  );
  gain.gain.setValueAtTime(0.11, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.18);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}
document.addEventListener("pointerdown", unlockAudio, { passive: true });
document.addEventListener("keydown", unlockAudio);

function visibleGame(): Game {
  return (
    practiceGame ??
    branch ??
    (reviewCursor !== null && reviewCursor < game.moves.length
      ? replay(
          game.moves.slice(0, reviewCursor).map((m) => m.index),
          game.rule,
        )
      : game)
  );
}
function canPlay() {
  const current = visibleGame();
  if (activeTab === "history" || document.hidden || current.outcome || busyHint)
    return false;
  if (practiceGame) return !practiceSolved;
  if (branch) return true;
  if (paused) return false;
  if (reviewCursor !== null || thinking || errorState) return false;
  return settings.mode === "local" || game.next === settings.human;
}
function cancelWork() {
  ai.cancel();
  analyst.cancel();
  thinking = false;
  busyHint = false;
  hint = null;
  hintMessage = "";
  selected = -1;
}
function setDraft() {
  $("#difficulty").setAttribute("aria-label", "AI 난이도");
  $<HTMLSelectElement>("#difficulty").value = draft.difficulty;
  $<HTMLSelectElement>("#human").value = String(draft.human);
  $<HTMLSelectElement>("#rule").value = draft.rule;
  $<HTMLSelectElement>("#difficulty").disabled = draft.mode === "local";
  $<HTMLSelectElement>("#human").disabled = draft.mode === "local";
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
    b.classList.toggle("selected", b.dataset.mode === draft.mode);
    b.setAttribute("aria-pressed", String(b.dataset.mode === draft.mode));
  });
  $("#rule-description").textContent =
    ruleHelp(draft.rule) + " 금수는 없습니다.";
}
function render() {
  const current = visibleGame(),
    reviewing = reviewCursor !== null;
  document.documentElement.dataset.theme = theme;
  $("#sound").innerHTML = icon(sound ? "sound" : "mute");
  $("#sound").setAttribute("aria-label", sound ? "소리 끄기" : "소리 켜기");
  $("#sound").setAttribute("aria-pressed", String(sound));
  $("#theme").setAttribute(
    "aria-label",
    `테마 변경 · 현재 ${theme === "wood" ? "우드" : theme === "modern" ? "모던" : "다크"}`,
  );
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === activeTab);
    b.setAttribute(
      "aria-current",
      b.dataset.tab === activeTab ? "page" : "false",
    );
  });
  $("#history-page").hidden = activeTab !== "history";
  $("#practice-page").hidden = activeTab !== "practice";
  $("#game-layout").hidden =
    activeTab === "history" || (activeTab === "practice" && !practiceGame);
  $("#moves-section").hidden = activeTab !== "play";
  const black = practiceGame
    ? "연습 · 흑"
    : settings.mode === "local"
      ? "플레이어 1"
      : settings.human === 1
        ? "나"
        : "오목 AI";
  const white = practiceGame
    ? "연습 · 백"
    : settings.mode === "local"
      ? "플레이어 2"
      : settings.human === 2
        ? "나"
        : "오목 AI";
  $("#black-name").textContent = black;
  $("#white-name").textContent = white;
  $("#black-player").classList.toggle(
    "current",
    !current.outcome && current.next === 1,
  );
  $("#white-player").classList.toggle(
    "current",
    !current.outcome && current.next === 2,
  );
  const last = current.moves.at(-1);
  const numbers = new Map(current.moves.map((m, i) => [m.index, i + 1]));
  cells.forEach((cell, i) => {
    const value = current.board[i];
    cell.className = `cell ${value === 1 ? "black occupied" : value === 2 ? "white occupied" : ""}${last?.index === i ? " last" : ""}${current.outcome?.line.includes(i) ? " winning" : ""}${selected === i ? " selected-cell" : ""}${hint?.index === i && !value ? " hinted" : ""}`;
    cell.setAttribute(
      "aria-label",
      `${coord(i)} ${value ? `${colorName(value as Player)} ${numbers.get(i)}수${last?.index === i ? " 마지막 착수" : ""}` : "빈 자리"}${hint?.index === i ? " 추천" : ""}`,
    );
    cell.setAttribute("aria-disabled", String(Boolean(value) || !canPlay()));
    cell.tabIndex = i === keyboardIndex ? 0 : -1;
    cell.querySelector(".stone")!.textContent =
      reviewing && value ? String(numbers.get(i)) : "";
    cell.querySelector(".cell-marker")!.textContent =
      hint?.index === i && !value ? "✦" : "";
  });
  $("#board").classList.toggle("can-play", canPlay());
  $("#board").classList.toggle("reviewing", reviewing);
  $("#board").classList.toggle("white-turn", current.next === 2);
  $("#board-rule").textContent =
    `${current.rule === "freestyle" ? "FREESTYLE" : "EXACT FIVE"} · 15 × 15`;
  $("#last-move").textContent = last
    ? `마지막 착수 ${coord(last.index)} · ${colorName(last.player)}`
    : "첫 수를 놓아보세요";
  $("#move-count").textContent = `${current.moves.length}수`;
  $("#meta-moves").textContent = String(current.moves.length);
  $("#meta-level").textContent =
    settings.mode === "local" || practiceGame
      ? "2인"
      : LEVELS[settings.difficulty].label;
  $("#mode-label").textContent = practiceGame
    ? `연습실 · ${puzzles[practiceIndex!].title}`
    : branch
      ? "분기 분석 · 원본 기보 보존"
      : reviewing
        ? "대국 복기"
        : `${settings.mode === "ai" ? "AI와 대국" : "같은 기기에서 둘이"} · ${ruleName(settings.rule)}`;
  let title = `${colorName(current.next)}의 차례입니다`,
    help =
      settings.mode === "ai"
        ? "천천히 생각하고, 마음에 드는 곳에 놓아보세요."
        : "두 사람이 번갈아 한 수씩 놓아주세요.";
  if (current.outcome) {
    title = current.outcome.winner
      ? `${colorName(current.outcome.winner)} 승리!`
      : "무승부입니다";
    help =
      current.outcome.reason === "resign"
        ? "기권으로 대국이 종료되었습니다."
        : current.outcome.reason === "draw"
          ? "모든 자리가 찼습니다. 좋은 대국이었어요."
          : "좋은 대국이었어요. 복기에서 한 수씩 다시 만나보세요.";
  } else if (practiceGame) {
    title = practiceSolved ? "잘 찾았어요!" : puzzles[practiceIndex!].title;
    help = puzzles[practiceIndex!].subtitle;
  } else if (reviewing) {
    title = branch ? "다른 길을 살펴보세요" : `${reviewCursor}수의 장면`;
    help = branch
      ? "흑과 백을 번갈아 놓아보세요. 원본 기록에는 영향을 주지 않습니다."
      : "수 번호를 따라가며 힌트로 대안을 비교하세요.";
  } else if (paused) {
    title = "잠시 쉬어가는 중";
    help = "계속하기를 누르면 대국을 이어갑니다.";
  } else if (errorState) {
    title = "AI를 다시 불러주세요";
    help = "현재 대국은 보존되어 있습니다.";
  } else if (thinking) {
    title = "AI가 생각하고 있어요";
    help = `${LEVELS[settings.difficulty].label} 난이도 · 다음 한 수를 살피고 있습니다.`;
  }
  $("#status").textContent = title;
  $("#status-help").textContent = help;
  $(".live-dot").classList.toggle("thinking", thinking || busyHint);
  $("#hint-text").textContent =
    hintMessage ||
    "어디에 놓을지 고민되나요? 추천 수와 그 이유를 함께 살펴보세요.";
  $("#hint").innerHTML =
    `${busyHint ? "살펴보는 중…" : "힌트 보기"} ${icon("chevron")}`;
  $<HTMLButtonElement>("#hint").disabled =
    busyHint ||
    thinking ||
    Boolean(current.outcome) ||
    paused ||
    practiceSolved;
  $<HTMLButtonElement>("#undo").disabled =
    !game.moves.length ||
    reviewing ||
    Boolean(practiceGame) ||
    (settings.mode === "ai" &&
      !game.moves.some((m) => m.player === settings.human));
  $<HTMLButtonElement>("#pause").disabled =
    Boolean(game.outcome) || reviewing || Boolean(practiceGame);
  $("#pause").textContent = paused ? "▷ 계속하기" : "Ⅱ 일시정지";
  $<HTMLButtonElement>("#resign").disabled =
    Boolean(game.outcome) || reviewing || Boolean(practiceGame);
  $("#retry").hidden = !errorState;
  $("#selection-bar").hidden = selected < 0;
  $("#selection-text").textContent =
    selected < 0
      ? ""
      : `${coord(selected)}에 ${colorName(current.next)}돌을 놓을까요?`;
  $("#review-bar").hidden = !reviewing;
  $("#review-count").textContent =
    `${reviewCursor ?? 0} / ${game.moves.length}수${branch ? " · 분기" : ""}`;
  $("#branch-button").textContent = branch ? "분기 초기화" : "다른 수 놓기";
  $<HTMLButtonElement>("#review").disabled = !game.moves.length;
  $<HTMLButtonElement>("#save").disabled = !game.moves.length && !game.outcome;
  $("#history-count").textContent = `${game.moves.length}수`;
  $("#move-list").innerHTML = game.moves.length
    ? game.moves
        .map(
          (m, i) =>
            `<button class="move-chip ${reviewCursor === i + 1 ? "active" : ""}" data-move="${i + 1}"><small>${i + 1}</small><i class="mini-stone ${m.player === 1 ? "black" : "white"}"></i>${coord(m.index)}</button>`,
        )
        .join("")
    : '<p class="empty-moves">아직 놓인 돌이 없어요. 첫 번째 이야기를 시작해 보세요.</p>';
  renderClock();
}
function renderClock() {
  $("#clock").textContent =
    `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;
}

function scheduleAI() {
  if (
    settings.mode !== "ai" ||
    game.next === settings.human ||
    game.outcome ||
    paused ||
    document.hidden ||
    reviewCursor !== null ||
    practiceGame ||
    activeTab !== "play" ||
    errorState
  )
    return;
  thinking = true;
  render();
  const expected = game;
  ai.run(
    game,
    settings.difficulty,
    { seed: (seed + game.moves.length) >>> 0 },
    (result, fallback) => {
      if (
        game !== expected ||
        paused ||
        document.hidden ||
        activeTab !== "play" ||
        reviewCursor !== null
      )
        return;
      thinking = false;
      if (
        !Number.isInteger(result.index) ||
        result.index < 0 ||
        result.index >= CELLS ||
        game.board[result.index]
      ) {
        errorState = true;
        toast("AI가 유효한 수를 찾지 못했습니다. 다시 시도해 주세요.");
        render();
        return;
      }
      if (fallback)
        toast("AI 엔진을 불러오지 못해 이번 수는 기본 전술 모드로 진행합니다.");
      commit(result.index);
    },
    (message) => {
      thinking = false;
      errorState = true;
      toast(message);
      render();
    },
  );
}
function commit(index: number) {
  try {
    game = play(game, index);
  } catch (e) {
    toast((e as Error).message);
    return;
  }
  selected = -1;
  hint = null;
  hintMessage = "";
  analyst.cancel();
  busyHint = false;
  tone(Boolean(game.outcome));
  persist();
  if (game.outcome) archive();
  render();
  scheduleAI();
}
function attempt(index: number) {
  if (!canPlay() || visibleGame().board[index]) return;
  if (practiceGame) {
    const before = practiceGame,
      after = play(before, index),
      kind = puzzles[practiceIndex!].kind;
    const correct =
      kind === "win"
        ? after.outcome?.winner === before.next
        : kind === "block"
          ? winningMoves([...after.board], other(before.next), before.rule)
              .length === 0
          : (kind === "sequence" && after.outcome?.winner === before.next) ||
            (winningMoves([...after.board], before.next, before.rule).length >=
              2 &&
              winningMoves([...after.board], other(before.next), before.rule)
                .length === 0);
    selected = -1;
    if (correct) {
      practiceGame = after;
      practiceSolved = kind !== "sequence" || Boolean(after.outcome);
      hint = null;
      if (!practiceSolved) {
        const defense = winningMoves(
          [...after.board],
          before.next,
          before.rule,
        )[0];
        practiceGame = play(after, defense);
        hintMessage = `좋은 공격입니다. 백이 ${coord(defense)}에서 막았어요. 이제 남은 승리 수를 찾아 마무리하세요.`;
      } else
        hintMessage =
          "정답입니다! 규칙 엔진으로 목표 달성을 확인했어요. 위의 다른 문제에도 도전해 보세요.";
      tone(true);
    } else {
      hintMessage =
        "아직 목표를 달성하지 못했어요. 상대가 바로 이길 자리와 열린 양끝을 살펴보세요.";
      tone();
    }
    render();
    return;
  }
  if (branch) {
    branch = play(branch, index);
    selected = -1;
    hint = null;
    hintMessage = "";
    tone(Boolean(branch.outcome));
    render();
    return;
  }
  commit(index);
}
let touchStart: { x: number; y: number; id: number } | null = null,
  dragged = false,
  multiTouch = false;
$("#board").addEventListener("pointerdown", (e) => {
  if (!e.isPrimary) {
    multiTouch = true;
    return;
  }
  touchStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
  dragged = false;
  multiTouch = false;
});
$("#board").addEventListener("pointermove", (e) => {
  if (
    touchStart &&
    e.pointerId === touchStart.id &&
    Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) > 10
  )
    dragged = true;
});
$("#board").addEventListener("pointercancel", () => {
  dragged = true;
  touchStart = null;
});
$("#board").addEventListener("click", (e) => {
  const cell = (e.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-cell]",
  );
  if (
    !cell ||
    e.detail > 1 ||
    (e.detail !== 0 && (dragged || multiTouch)) ||
    !canPlay()
  )
    return;
  const i = Number(cell.dataset.cell);
  if (visibleGame().board[i]) return;
  keyboardIndex = i;
  if (confirmTap && e.detail !== 0) {
    selected = i;
    render();
  } else attempt(i);
});
$("#board").addEventListener("keydown", (e) => {
  if (
    ![
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "Escape",
    ].includes(e.key)
  )
    return;
  e.preventDefault();
  if (e.key === "Escape") {
    selected = -1;
    render();
    return;
  }
  const x = keyboardIndex % SIZE,
    y = Math.floor(keyboardIndex / SIZE);
  keyboardIndex =
    e.key === "Home"
      ? y * SIZE
      : e.key === "End"
        ? y * SIZE + 14
        : e.key === "ArrowLeft"
          ? y * SIZE + Math.max(0, x - 1)
          : e.key === "ArrowRight"
            ? y * SIZE + Math.min(14, x + 1)
            : e.key === "ArrowUp"
              ? Math.max(0, y - 1) * SIZE + x
              : Math.min(14, y + 1) * SIZE + x;
  render();
  cells[keyboardIndex].focus();
});
$("#confirm-move").onclick = () => {
  if (selected >= 0) attempt(selected);
};
$("#cancel-selection").onclick = () => {
  selected = -1;
  render();
};
$("#confirm-tap").onchange = (e) => {
  confirmTap = (e.target as HTMLInputElement).checked;
  selected = -1;
  savePrefs();
  render();
};

const dialog = $<HTMLDialogElement>("#dialog");
function confirmAction(
  title: string,
  description: string,
  action: () => void,
  label = "계속",
) {
  const wasPaused = paused;
  cancelWork();
  paused = true;
  render();
  $("#dialog-content").innerHTML =
    `<span class="eyebrow">OMOK STUDIO</span><h2 id="dialog-title"></h2><p id="dialog-description"></p><div class="dialog-actions"><button id="dialog-cancel" class="secondary">취소</button><button id="dialog-ok" class="primary"></button></div>`;
  $("#dialog-title").textContent = title;
  $("#dialog-description").textContent = description;
  $("#dialog-ok").textContent = label;
  let confirmed = false;
  $("#dialog-cancel").onclick = () => dialog.close();
  $("#dialog-ok").onclick = () => {
    confirmed = true;
    dialog.close();
  };
  dialog.onclose = () => {
    paused = wasPaused;
    if (confirmed) action();
    else {
      render();
      scheduleAI();
    }
  };
  dialog.showModal();
}
function startNew() {
  archive();
  cancelWork();
  settings = { ...draft };
  game = emptyGame(settings.rule);
  createdAt = new Date().toISOString();
  elapsed = 0;
  seed = randomSeed();
  paused = false;
  errorState = false;
  reviewCursor = null;
  branch = null;
  practiceGame = null;
  practiceIndex = null;
  activeTab = "play";
  persist();
  render();
  scheduleAI();
}
$("#new-game").onclick = () => {
  if (game.moves.length && !game.outcome)
    confirmAction(
      "새로운 대국을 시작할까요?",
      "현재 대국은 기록에 보관합니다. 선택한 설정으로 새 판을 시작합니다.",
      startNew,
      "새 대국 시작",
    );
  else startNew();
};
$("#undo").onclick = () => {
  cancelWork();
  game = undo(game, settings);
  errorState = false;
  persist();
  render();
  scheduleAI();
};
$("#pause").onclick = () => {
  paused = !paused;
  cancelWork();
  render();
  if (!paused) scheduleAI();
  persist();
};
$("#resign").onclick = () =>
  confirmAction(
    "이번 대국을 마칠까요?",
    `${colorName(settings.mode === "ai" ? settings.human : game.next)}의 기권으로 상대가 승리합니다.`,
    () => {
      cancelWork();
      game = resign(game, settings.mode === "ai" ? settings.human : game.next);
      paused = false;
      persist();
      archive();
      tone(true);
      render();
    },
    "기권하기",
  );
$("#retry").onclick = () => {
  errorState = false;
  scheduleAI();
};
document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      draft.mode = b.dataset.mode as Settings["mode"];
      setDraft();
    }),
);
$("#difficulty").onchange = (e) => {
  draft.difficulty = (e.target as HTMLSelectElement)
    .value as Settings["difficulty"];
};
$("#human").onchange = (e) => {
  draft.human = Number((e.target as HTMLSelectElement).value) as Player;
};
$("#rule").onchange = (e) => {
  draft.rule = (e.target as HTMLSelectElement).value as Settings["rule"];
  setDraft();
};
$("#sound").onclick = () => {
  sound = !sound;
  if (sound) {
    unlockAudio();
    tone();
  }
  savePrefs();
  render();
};
$("#theme").onclick = () => {
  theme = ["wood", "modern", "dark"][
    (["wood", "modern", "dark"].indexOf(theme) + 1) % 3
  ];
  savePrefs();
  render();
};

$("#hint").onclick = () => {
  const current = visibleGame();
  if (current.outcome || thinking || busyHint) return;
  busyHint = true;
  selected = -1;
  render();
  analyst.run(
    current,
    "expert",
    { seed, timeMs: 900 },
    (result, fallback) => {
      busyHint = false;
      hint = result;
      const actual =
        reviewCursor !== null && !branch ? game.moves[reviewCursor] : undefined;
      let comparison = "";
      if (actual) {
        const missedWin =
          result.reason === "win" && !play(current, actual.index).outcome;
        comparison = ` 실제 다음 수 ${coord(actual.index)} · 추천 ${coord(result.index)}.${missedWin ? " 즉시 승리를 놓친 수입니다." : actual.index !== result.index ? " 다른 선택지로 비교해 보세요. 실제 수가 실수라는 뜻은 아닙니다." : " 추천과 같은 수를 두었어요."}`;
      }
      hintMessage = `${coord(result.index)} · ${explain(result)}${comparison} ${result.reason === "win" || result.reason === "block" ? "한 수 전술 확인." : `완료 깊이 ${result.depth} · ${Math.round(result.elapsed)}ms${result.limited ? " · 시간 제한 도달" : ""}.`}${fallback ? " 기본 전술 대체 모드." : ""}`;
      render();
    },
    (message) => {
      busyHint = false;
      toast(message);
      render();
    },
  );
};
function reviewAt(cursor: number) {
  cancelWork();
  branch = null;
  reviewCursor = Math.max(0, Math.min(game.moves.length, cursor));
  render();
}
$("#review").onclick = () => reviewAt(0);
$("#move-list").onclick = (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-move]");
  if (b) reviewAt(Number(b.dataset.move));
};
document.querySelectorAll<HTMLButtonElement>("[data-review]").forEach(
  (b) =>
    (b.onclick = () => {
      const action = b.dataset.review;
      reviewAt(
        action === "first"
          ? 0
          : action === "last"
            ? game.moves.length
            : (reviewCursor ?? 0) + (action === "prev" ? -1 : 1),
      );
    }),
);
$("#branch-button").onclick = () => {
  cancelWork();
  branch = replay(
    game.moves.slice(0, reviewCursor!).map((m) => m.index),
    game.rule,
  );
  render();
};
$("#exit-review").onclick = () => {
  cancelWork();
  reviewCursor = null;
  branch = null;
  render();
  scheduleAI();
};
$("#save").onclick = () => {
  archive();
  toast(
    storageWarning
      ? "저장 상태를 확인할 수 없습니다. 파일로 내보내세요."
      : "대국 기록에 보관했습니다.",
  );
};
$("#export").onclick = () => {
  const blob = new Blob([JSON.stringify(record(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `omok-${createdAt.slice(0, 10)}-${game.moves.length}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document
  .querySelectorAll<HTMLButtonElement>(".import-trigger")
  .forEach(
    (b) => (b.onclick = () => $<HTMLInputElement>("#import-file").click()),
  );
function loadRecord(data: RecordData, review = false) {
  const loaded = parseRecord(data);
  archive();
  cancelWork();
  settings = loaded.record.settings;
  draft = { ...settings };
  game = loaded.game;
  createdAt = loaded.record.createdAt;
  elapsed = loaded.record.elapsed;
  seed = loaded.record.seed;
  paused = false;
  errorState = false;
  branch = null;
  practiceGame = null;
  practiceIndex = null;
  activeTab = "play";
  reviewCursor = review ? 0 : null;
  setDraft();
  persist();
  render();
  if (!review) scheduleAI();
}
$("#import-file").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    if (file.size > 100000)
      throw new Error("기보 파일은 100KB 이하여야 합니다.");
    const { record: data } = parseRecord(JSON.parse(await file.text()));
    if (game.moves.length)
      confirmAction(
        "기보를 불러올까요?",
        "현재 대국을 기록에 보관하고 가져온 대국을 엽니다.",
        () => loadRecord(data),
        "불러오기",
      );
    else loadRecord(data);
  } catch (error) {
    toast(`가져오기 실패: ${(error as Error).message}`);
  }
};
function renderHistory() {
  const list = history();
  $("#history-list").innerHTML = list.length
    ? list
        .map((r, i) => {
          const g = parseRecord(r).game,
            result = g.outcome
              ? g.outcome.winner
                ? `${colorName(g.outcome.winner)} 승리`
                : "무승부"
              : "진행 중";
          return `<button class="history-card" data-record="${i}"><span class="record-symbol">${icon("book")}</span><span><b>${ruleName(r.settings.rule)} · ${r.settings.mode === "ai" ? "AI 대국" : "2인 대국"}</b><small>${new Date(r.createdAt).toLocaleString("ko-KR")} · ${r.moves.length}수</small></span><span class="result-tag">${result}</span>${icon("chevron")}</button>`;
        })
        .join("")
    : '<div class="empty-history"><span>○ ● ○</span><h3>한 판의 이야기가 쌓이는 곳</h3><p>대국을 마치거나 ‘기록 보관’을 누르면 여기에서 다시 볼 수 있어요.</p><button id="back-to-play" class="primary">첫 대국 시작하기</button></div>';
  $("#back-to-play")?.addEventListener("click", () => changeTab("play"));
  document.querySelectorAll<HTMLButtonElement>("[data-record]").forEach(
    (b) =>
      (b.onclick = () => {
        const selectedRecord = list[Number(b.dataset.record)];
        confirmAction(
          "이 대국을 복기할까요?",
          "현재 대국은 기록에 보관됩니다.",
          () => loadRecord(selectedRecord, true),
          "복기 열기",
        );
      }),
  );
}
function changeTab(tab: typeof activeTab) {
  cancelWork();
  activeTab = tab;
  practiceGame = null;
  practiceIndex = null;
  practiceSolved = false;
  if (tab === "history") renderHistory();
  render();
  if (tab === "play") scheduleAI();
}
document
  .querySelectorAll<HTMLButtonElement>("[data-tab]")
  .forEach(
    (b) => (b.onclick = () => changeTab(b.dataset.tab as typeof activeTab)),
  );
$(".brand").onclick = (e) => {
  e.preventDefault();
  changeTab("play");
};
document.querySelectorAll<HTMLButtonElement>("[data-puzzle]").forEach(
  (b) =>
    (b.onclick = () => {
      cancelWork();
      practiceIndex = Number(b.dataset.puzzle);
      practiceGame = puzzles[practiceIndex].game;
      practiceSolved = false;
      paused = false;
      reviewCursor = null;
      branch = null;
      render();
    }),
);
$("#guide").onclick = () => {
  const wasPaused = paused;
  cancelWork();
  paused = true;
  render();
  $("#dialog-content").innerHTML =
    `<span class="eyebrow">A GUIDE TO OMOK</span><h2 id="dialog-title">한 수씩, 편안하게.</h2><div class="guide-copy"><h3>먼저 다섯 개를 이으세요</h3><p>15×15 판에서 흑부터 번갈아 둡니다. 자유 오목은 5개 이상, 정확히 5목은 딱 5개가 승리입니다. 두 규칙 모두 금수나 오프닝 제한은 없습니다.</p><h3>조작과 무르기</h3><p>터치는 자리를 고른 뒤 ‘여기에 놓기’로 확인하세요. 방향키로 이동하고 Enter 또는 Space로 착수할 수도 있습니다. AI 대국의 무르기는 내 마지막 수와 AI의 응수를 함께 되돌립니다.</p><h3>세 가지 AI</h3><p>입문은 깊이 1·65ms, 균형은 깊이 3·350ms, 도전은 깊이 5·1,200ms를 목표로 탐색합니다. 기기와 국면에 따라 완료 깊이가 달라집니다. 모든 난이도에서 즉시 승리와 필수 방어를 먼저 살핍니다.</p><h3>기록과 학습</h3><p>진행 중 대국은 자동 저장합니다. 복기 중 힌트는 실제 수와 대안을 비교하며, ‘다른 수 놓기’는 원본과 별개로 탐색합니다. 저장은 이 브라우저 안에서만 이루어집니다.</p><h3>현재 지원 범위</h3><p>자유 오목·정확히 5목, AI·같은 기기 2인 대국을 지원합니다. 렌주, 온라인 대전, 학습 모델은 제공하지 않습니다. AI의 공식 기력이나 승률은 측정되지 않았습니다.</p></div><button id="guide-close" class="primary full">이제 두어볼까요</button>`;
  $("#guide-close").onclick = () => dialog.close();
  dialog.onclose = () => {
    paused = wasPaused;
    render();
    scheduleAI();
  };
  dialog.showModal();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelWork();
    persist();
    void audio?.suspend();
  } else {
    render();
    scheduleAI();
  }
});
window.addEventListener("pagehide", persist);
let lastTick = Date.now(),
  ticks = 0;
setInterval(() => {
  const now = Date.now(),
    delta = Math.max(0, Math.min(2, (now - lastTick) / 1000));
  lastTick = now;
  if (
    !document.hidden &&
    !paused &&
    !game.outcome &&
    game.moves.length &&
    activeTab === "play" &&
    reviewCursor === null
  ) {
    elapsed += delta;
    renderClock();
    if (++ticks % 10 === 0) persist();
  }
}, 1000);
setDraft();
render();
scheduleAI();
if (storageWarning)
  toast(
    "저장된 데이터를 읽지 못했거나 저장 공간을 사용할 수 없습니다. 기보 파일을 이용해 주세요.",
  );
else if (restored && game.moves.length)
  toast("이전 대국을 이어서 불러왔습니다.");
