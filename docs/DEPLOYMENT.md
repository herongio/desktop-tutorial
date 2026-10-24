# GitHub Pages 배포

대상 저장소는 `herongio/desktop-tutorial`, 사이트 경로는 `/desktop-tutorial/`이다. 사용자의 승인 및 GitHub 설정 변경으로 공개 저장소의 Pages 사이트가 활성화되었다.

## 현재 진행 상태

- 2026-10-24: 게임 소스를 `main`에 반영했다(`dbc4fd5`).
- 정적 산출물과 `.nojekyll`을 `gh-pages`에 반영했다(`53f1817`). 강제 push는 사용하지 않았다.
- `/desktop-tutorial/` 경로로 제공한 빌드를 실제 Chromium에서 열어 AI 응수·새로고침 복원·힌트를 검증했다. JS/CSS/Worker 로딩 오류는 없었다.
- **배포 완료:** https://herongio.github.io/desktop-tutorial/
- GitHub에서 저장소 공개 전환과 Pages 소스 설정을 완료한 뒤 `status: built`, `gh-pages` 브랜치의 `53f1817` 배포 성공을 확인했다. 실행 기록: https://github.com/herongio/desktop-tutorial/actions/runs/40087837103
- 2026-10-24 19:58 KST: 공개 사이트의 HTML·JS·CSS·Worker를 기존 시스템 TLS 검증으로 가져왔다. 그 응답을 Chromium 요청에 연결해 데스크톱 및 모바일 터치 에뮬레이션에서 AI 응수·새로고침 복원·힌트·기보 내보내기/가져오기를 검증했다. 페이지 오류는 없었다. 원본 결과는 [deployment-live.json](deployment-live.json)에 있다.
- 클라우드 Chromium의 직접 HTTPS 접속은 환경 프록시 CA 신뢰 오류 때문에 미검증이다. 영구 인증서 신뢰 저장소 변경은 자동 승인 검토에서 거절되어 변경하지 않았고, TLS 검증을 끄지도 않았다. 대신 이미 구성된 시스템 CA를 사용하는 HTTPS 요청으로 공개 파일을 검증했다.

## 빌드와 활성화

```bash
npm ci --cache /tmp/omok-npm-cache --no-audit --no-fund
npm run build:pages
```

`dist/`의 정적 파일만 `gh-pages` 브랜치 루트에 배포한다. 해당 브랜치에는 `.nojekyll` 파일도 포함한다. 소스, 테스트, 로컬 기보나 자격 증명은 배포 산출물에 포함하지 않는다.

GitHub 저장소 **Settings → Pages → Build and deployment**에서 다음과 같이 설정한다.

- Source: **Deploy from a branch**
- Branch: **gh-pages**
- Folder: **/ (root)**
- **Save**

현재 실행 주소는 `https://herongio.github.io/desktop-tutorial/`이다. 이후 업데이트에서는 GitHub 빌드 성공과 실제 사이트 반영을 다시 확인한다. 유료 플랜 가입은 하지 않았다.

배포가 완료되면 실제 사이트에서 첫 수/AI 응수, 새로고침, 기보 가져오기와 Worker 파일 로딩을 확인한다. HTTPS 응답만으로 대국 검증을 대신하지 않는다.

후속 업데이트에서도 기존 `gh-pages` 브랜치 이력을 유지해 커밋하고 fast-forward push한다. 다른 사람이 올린 변경을 강제 덮어쓰지 않는다. 앱 소스는 `main`에 유지한다.
