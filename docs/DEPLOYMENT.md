# GitHub Pages 배포

대상 저장소는 `herongio/desktop-tutorial`, 사이트 경로는 `/desktop-tutorial/`이다. 저장소 자체의 공개/비공개 설정은 변경하지 않는다.

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
