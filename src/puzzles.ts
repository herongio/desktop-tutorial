import { replay, type Game } from "./rules";
export interface Puzzle {
  title: string;
  subtitle: string;
  game: Game;
  kind: "win" | "block" | "fork" | "sequence";
}
export const puzzles: Puzzle[] = [
  {
    title: "마지막 한 자리",
    subtitle: "흑 차례 · 한 수로 승리하세요. 정답은 하나가 아닐 수 있습니다.",
    game: replay([108, 0, 109, 2, 110, 4, 111, 6], "freestyle"),
    kind: "win",
  },
  {
    title: "공격보다 먼저",
    subtitle: "흑 차례 · 백의 다음 수 승리를 모두 막으세요.",
    game: replay([107, 108, 30, 109, 32, 110, 34, 111], "freestyle"),
    kind: "block",
  },
  {
    title: "두 갈래의 위협",
    subtitle:
      "흑 차례 · 서로 다른 두 곳에서 다음 수 승리를 만들 수 있는 자리를 찾으세요.",
    game: replay([109, 0, 110, 2, 111, 4], "freestyle"),
    kind: "fork",
  },
  {
    title: "끝까지 이어가기",
    subtitle:
      "흑 차례 · 열린 4를 만들고, 백의 방어 뒤에 승리하는 수를 찾아보세요.",
    game: replay([82, 0, 97, 2, 112, 4], "freestyle"),
    kind: "sequence",
  },
];
