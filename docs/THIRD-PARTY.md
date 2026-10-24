# 외부 도구와 에셋

런타임 애플리케이션은 외부 서비스, 엔진, 신경망 모델, 이미지, 오디오 파일, 웹폰트를 다운로드하지 않는다. 화면의 SVG 아이콘과 돌/보드 스타일은 이 프로젝트에서 작성했다. 착수/결과음은 Web Audio oscillator로 합성한다. 글꼴은 사용자 기기의 시스템 글꼴을 이용한다.

개발 도구는 npm에서 설치하며 정확한 버전과 무결성 해시는 `package-lock.json`에 있다. 번들에 외부 오목 엔진 코드를 포함하지 않는다.

| 직접 개발 의존성 | 이용 조건 |
| --- | --- |
| Vite | MIT |
| TypeScript | Apache-2.0 |
| tsx | MIT |
| Playwright Test | Apache-2.0 |
| ESLint / @eslint/js | MIT |
| typescript-eslint | MIT |
| @types/node | MIT |

각 패키지와 전이 의존성의 라이선스 원문은 해당 `node_modules` 디렉터리 및 공식 저장소에 있다. Chromium은 검증용 브라우저로 사용했으며 앱에 배포하지 않는다. Prettier 3.6.2(MIT)는 개발 중 코드 정리에만 사용했고 런타임에 포함하지 않았다.

참고 연구: Rapfi GPL v3, KataGo 주 코드 MIT 및 일부 예외를 확인했다. 문서의 원리를 비교해 설계 판단에 활용했으며 소스·데이터·모델을 복사하지 않았다. [AI-RESEARCH.md](AI-RESEARCH.md)에 직접 확인한 문서와 적용 범위를 기록했다.
