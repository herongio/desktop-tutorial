# 오목 · OMOK STUDIO

한 수에, 온전히. 가입 없이 바로 즐기는 브라우저 오목 게임입니다.

**[오목 바로 플레이하기](https://herongio.github.io/desktop-tutorial/)**

기존 저장소에는 GitHub Desktop 연습용 README만 있었으며, 사용자의 신규 구현 요청에 따라 만들었습니다. TypeScript + Vite 정적 웹 앱으로, 계정·백엔드·유료 API·외부 엔진 없이 실행합니다.

## 실행

Node.js 22.12 이상 또는 24 LTS를 사용하세요. 검증 환경은 Node 24.19.0 / npm 11.9.0입니다.

```bash
cd /workspace/desktop-tutorial
npm ci --cache /tmp/omok-npm-cache
npm run dev -- --port 5173 --strictPort
```

일반 로컬 개발 환경에서는 터미널에 표시되는 Vite 주소를 브라우저에서 열면 됩니다. 클라우드 온보딩 환경의 loopback 주소는 외부에서 접근할 수 있는 배포 주소가 아닙니다. 확인용 화면은 [데스크톱](docs/screenshots/desktop.png), [모바일](docs/screenshots/mobile.png)에 있습니다.

```bash
npm test              # 규칙/전술 단위 테스트
npm run typecheck     # 엄격한 TypeScript 검사
npm run lint          # ESLint
npm run build         # 타입 검사 + dist/ 생성
npm run test:e2e      # Chromium에서 실제 UI 대국/회귀 검사
npm run bench         # 흑백 교대 6판, docs/benchmark.json 생성
npm run preview -- --port 4173 --strictPort
# 별도 터미널에서 production 번들 동작과 응답성 측정:
OMOK_BASE_URL=http://127.0.0.1:4173 npm run perf
```

브라우저 검사는 `/usr/bin/chromium`을 기본 사용합니다. 다른 설치 경로에서는 `CHROMIUM_PATH`를 지정하세요. 테스트 실행 시 개발 서버가 없으면 Playwright가 자동으로 시작합니다. 개발 서버와 실제 게임 파일을 검사하는 동안 소스를 수정하면 Vite가 다시 불러오므로 검사를 재실행해야 합니다.

`dist/`를 정적 호스팅 루트에 제공하면 됩니다. 기본 빌드 경로는 `/`입니다. 이 저장소의 GitHub Pages 배포는 `npm run build:pages`로 `/desktop-tutorial/` 경로를 적용합니다. 배포 절차와 사이트 활성화 방법은 [DEPLOYMENT.md](docs/DEPLOYMENT.md)에 있습니다.

## 구현 기능

- 15×15 자유 오목(양측 5개 이상), 정확히 5목(양측 정확히 5개). 금수/오프닝 제한 없음.
- AI 대국, 같은 기기에서 2인 대국. 기본 설정으로 첫 수부터 플레이 가능.
- 입문·균형·도전: 탐색 깊이, 시간 예산, 후보 수를 달리한 독립 구현 AI.
- 즉시 승리/방어, 공격·수비 평가, 반복 심화 alpha-beta, 상태 캐시, 위협 응수 연장.
- Worker 격리, 계산 취소와 늦은 응답 무시, Worker 실패 시 알림과 기본 전술 대체.
- 새 대국, 일시정지, 기권, AI 한 턴 무르기, 종료 뒤 착수 차단.
- 자동 이어하기, 최근 30개 로컬 기록, 검증된 JSON 기보 입출력.
- 수 번호 복기, 처음/이전/다음/마지막 이동, 실제 수와 힌트 비교, 원본을 보존하는 분기 분석.
- 즉시 승리를 놓친 수 표시와 추정 후보 설명. 한 수 승리·필수 방어·복합 위협·연속 공격 연습 4개.
- 우드·모던·다크 테마, 절제된 돌 효과, 직접 합성한 착수/결과음과 음소거.
- 터치 미리보기/확인, 드래그·중복 클릭 방어, 방향키·Enter·Space 조작, 줄인 동작 설정 존중.

렌주, 온라인 대전, 계정, 동기화, Elo, 신경망 학습을 지원하는 것처럼 표시하지 않습니다. 이 브라우저의 저장소를 지우면 대국 기록도 사라집니다. 보관할 대국은 JSON 파일로 내보내세요.

## 코드 지도

| 경로 | 역할 |
| --- | --- |
| `src/rules.ts` | 공통 규칙, 판정, 무르기, 기보 검증 |
| `src/ai.ts` | 전술 검사, 탐색, 평가, 설명 |
| `src/ai.worker.ts`, `src/worker-client.ts` | 별도 스레드, 취소/오류 처리 |
| `src/main.ts` | UI·대국 상태·로컬 저장·복기·사운드 |
| `src/style.css` | 반응형 레이아웃·테마·접근성 스타일 |
| `src/puzzles.ts` | 엔진으로 검증하는 연습 국면 |
| `tests/` | 규칙·AI·브라우저 회귀 테스트 |
| `scripts/` | 대국 비교와 브라우저 성능 측정 |

[검수 결과와 재현 절차](docs/VALIDATION.md), [AI 연구·설계·라이선스 검토](docs/AI-RESEARCH.md), [외부 도구와 에셋](docs/THIRD-PARTY.md)을 참고하세요.
