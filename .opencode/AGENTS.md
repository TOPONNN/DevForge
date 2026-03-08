# Project: DevForge (Pokemon Hide & Seek)

## MANDATORY: Auto-Deploy After Every Change

**After ANY code modification is completed and verified (build passes), you MUST:**

1. **Commit** all changes using the project's semantic commit style (Korean):
   - `feat:` — 새 기능
   - `fix:` — 버그 수정
   - `style:` — UI/스타일 변경
   - `refactor:` — 코드 개선
   - `chore:` — 설정/인프라
   - Split into multiple atomic commits (different concerns = different commits)
   - Include Sisyphus footer and co-author

2. **Push** to `origin/master`:
   ```bash
   git push origin master
   ```

3. **Jenkins auto-deploys** — Jenkinsfile polls SCM every 2 minutes. After push:
   - Jenkins pulls latest from `origin/master`
   - Runs `docker compose build --parallel`
   - Runs `docker compose up -d`
   - Health checks nginx (port 80) and backend API (`/api/health`)

**DO NOT skip this step. Every change must be committed, pushed, and deployed.**

---

## Architecture

- **Frontend**: React + TypeScript + Vite + @react-three/fiber (3D)
- **Backend**: Express.js + WebSocket (ws)
- **State**: Redux Toolkit (gameSlice, networkSlice)
- **Deploy**: Docker Compose (nginx reverse proxy + frontend + backend)
- **CI/CD**: Jenkins (Jenkinsfile at repo root, pollSCM H/2)

## Git Config

- Branch: `master`
- Remote: `origin` → `https://github.com/TOPONNN/DevForge.git`
- Commit style: Korean semantic (feat:, fix:, style:, refactor:, chore:)
- Always include:
  ```
  Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-opencode)
  Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>
  ```

## Key Directories

```
frontend/src/
  components/    — React components (LobbyScreen, Player, GameScene, HUD, etc.)
  stores/        — Redux slices (gameSlice.ts, networkSlice.ts, store.ts, hooks.ts)
  types/         — TypeScript types (game.ts)
  index.css      — All styles (lines 1-400 = in-game, 400+ = lobby)

backend/src/
  ws/gameServer.js  — WebSocket game server

frontend/public/models/  — GLB 3D models
```
