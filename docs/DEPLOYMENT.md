# GitHub Pages 배포

대상 저장소는 `herongio/desktop-tutorial`, 사이트 경로는 `/desktop-tutorial/`이다. 저장소 자체의 공개/비공개 설정은 변경하지 않는다.

## 현재 진행 상태

- 2026-10-24: 게임 소스를 `main`에 반영했다(`dbc4fd5`).
- 정적 산출물과 `.nojekyll`을 `gh-pages`에 반영했다(`53f1817`). 강제 push는 사용하지 않았다.
- `/desktop-tutorial/` 경로로 제공한 빌드를 실제 Chromium에서 열어 AI 응수·새로고침 복원·힌트를 검증했다. JS/CSS/Worker 로딩 오류는 없었다.
- GitHub API에서 저장소가 비공개이며 `has_pages: false`임을 확인했다. Pages 조회와 생성 요청 모두 연결된 앱의 권한 제한으로 `403 Resource not accessible by integration`을 반환했다.
- 따라서 **Pages 활성화와 공개 사이트 검증은 미완료**다. 예정 주소는 확인 시점에 HTTP 404를 반환했다. 아래 설정은 저장소 관리자가 GitHub 화면에서 완료해야 한다. 인증 값을 채팅으로 공유할 필요는 없다.

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

예정 주소는 `https://herongio.github.io/desktop-tutorial/`이다. 설정 저장과 GitHub 빌드가 성공하기 전에는 실제 접속 가능한 주소라고 보장할 수 없다. 저장소가 비공개인 경우 계정 플랜에 따라 Pages 지원 여부가 달라질 수 있다. 유료 플랜 가입이나 저장소 공개 전환은 자동으로 수행하지 않는다.

배포가 완료되면 실제 사이트에서 첫 수/AI 응수, 새로고침, 기보 가져오기와 Worker 파일 로딩을 확인한다. HTTPS 응답만으로 대국 검증을 대신하지 않는다.

후속 업데이트에서도 기존 `gh-pages` 브랜치 이력을 유지해 커밋하고 fast-forward push한다. 다른 사람이 올린 변경을 강제 덮어쓰지 않는다. 앱 소스는 `main`에 유지한다.
