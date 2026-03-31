# Moxie Bug Patrol

## What This Is
A 2.5D isometric creature-collection web game. See Moxie_Bug_Patrol_GDD_v3.docx for full design spec.

## Commands
- `npm run dev` — Start dev server on port 3000
- `npm run build` — Production build (must pass before any push)
- `npm test` — Run tests (when available)

## Tech Stack
- Next.js (App Router, TypeScript)
- Phaser.js 3 (game engine)
- SVG sprites in public/sprites/ (never use Phaser Graphics API for characters or bugs)
- Vercel hosting (auto-deploys from main branch)

## Testing Rules
After EVERY code change:
1. Run npm run build — if it fails, fix it before moving on
2. Run npm run dev and open the game in a browser using computer use
3. Visually verify the specific thing you changed actually works
4. Screenshot any bugs you find
5. Do not mark anything as "fixed" unless you have visually confirmed it
6. If you cannot verify with computer use, say "UNVERIFIED" and explain why

## Git Rules
- Always commit and push directly to the main branch
- Never create worktree branches or feature branches unless explicitly asked
- Vercel only deploys from main
- Commit after each successful verification gate, not before

## Coordinate System
- All game logic operates in grid coordinates (integers 0-19 for a 20x20 grid)
- Only convert to screen/pixel coordinates at render time via gridToScreen() in constants.ts
- CatchSystem, SpawnSystem, InputSystem, CameraSystem all work in grid space
- Never compare screen pixels to grid coordinates

## Architecture
- PaloVerdeLane.ts is a scene orchestrator only — it creates systems and calls update methods
- Each system file handles one concern (InputSystem, CatchSystem, CameraSystem, SpawnSystem)
- New features go in new files. If a file exceeds 200 lines, split it
- SVG sprites in public/sprites/. Never draw characters or bugs with Phaser Graphics
- Phaser handles game rendering. React handles UI overlays. Communication via eventBus
- Camera: use direct scrollX/scrollY each frame. Never use Phaser startFollow()

## What NOT to Do
- Never use camera.startFollow() — caused drift in v1
- Never put a bug spawn point within 3 tiles of player start
- Never assume a code change works — always verify visually
- Never commit to a worktree branch
- Never ship without running npm run build first
