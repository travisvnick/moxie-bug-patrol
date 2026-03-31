# HANDOFF.md — Moxie Bug Patrol

Complete handoff document for migrating from Cowork/Dispatch to Claude Code.
Generated: March 30, 2026

---

## 1. Game Overview

**What is this game?**
Moxie Bug Patrol is a 2.5D isometric open-world exploration and creature-collection web game. Think Pokemon meets Sneaky Sasquatch, themed around Moxie Pest Control. Players are rookie pest control technicians who explore a desert neighborhood, discover hidden mutant bugs, and catch them using a timing-based mini-game.

**Core gameplay loop:**
1. Player explores an isometric desert map (Palo Verde Lane) using tap-and-hold movement
2. Walking near objects (trees, rocks, cacti) triggers hidden bugs to pop out with a "!" surprise
3. Player chases the fleeing bug and taps near it to activate a catch ring
4. Timing-based catch: ring pulses from large to small, tap in the green zone to catch
5. Successful catch shows a full-screen card with the bug's name, illustration, fun fact, and rarity
6. Bugs are collected in a Bug Book (Pokedex equivalent)

**Who is it for?**
- Primary: Travis's kids and their friends (ages 6-12)
- Secondary: Kids in the Ahwatukee, AZ neighborhood where Moxie Pest Control is launching
- Tertiary: Marketing tool for Moxie Pest Control's community events (Joel Maynerich, "The Ahwatukee Bug Guy")

**Setting:** Originally "Copper Creek, Arizona" — being pivoted to Ahwatukee (real Phoenix neighborhood) to align with Moxie's local marketing launch. The GDD still references Copper Creek but the final version will use real Ahwatukee neighborhoods as zones.

**Platforms:** Web-based, played on iPad Safari, Chromebook Chrome, and desktop browsers. Landscape orientation required.

---

## 2. Complete Feature List

### Movement System

**Tap-and-hold continuous movement**
- Intent: Like Sneaky Sasquatch — hold finger down, player walks toward finger position. Drag to change direction. Release to stop.
- Implementation: `game/scenes/PaloVerdeLane.ts` — `pointerdown` starts movement, `pointermove` updates target, `pointerup` stops. Player moves toward world-space tap position each frame.
- Status: **Partially working** — movement works but Travis reported it still requires multiple taps. The hold-to-move continuous tracking may not be registering properly on all mobile browsers. Needs real device testing.
- Compromise: WASD/arrow keys work as desktop fallback.

**Player centering / camera follow**
- Intent: Player stays dead center of screen. World scrolls around them. At map edges, camera stops and player walks toward screen border.
- Implementation: `PaloVerdeLane.ts` update loop — manual `cam.scrollX/scrollY` calculation centering on player position, clamped to world bounds. A `playerFollowTarget` rect was previously used with `startFollow()` but was removed in the deep audit due to causing drift.
- Status: **Unverified** — the deep audit replaced startFollow() with direct scrollX/scrollY assignment. Travis reported the player was drifting downward before the fix. The fix was deployed but not confirmed by Travis on his phone.
- Bug history: Multiple approaches tried (manual math, startFollow with invisible rect, direct assignment). The startFollow approach caused drift because the follow target wasn't updating correctly.

### Bug System

**Hidden bug spawning**
- Intent: Bugs are invisible on load. When player walks within ~1.5 grid tiles of a spawn point tied to an object, the bug pops out with a gold "!" text animation and starts fleeing.
- Implementation: `game/objects/Bug.ts` — bugs have `hidden` boolean, start with `alpha=0`. `reveal()` method sets hidden=false and alpha=1. `PaloVerdeLane.ts` checks proximity in update loop and calls reveal.
- Status: **Partially working** — bugs do reveal when you walk near them, but one bug (Tiny Tim) was spawning immediately on load because the spawn point was too close to player start. The deep audit moved it to [6,16]. This fix is unverified on device.

**Bug AI (wander/flee)**
- Intent: Revealed bugs wander slowly. When player gets close, they flee in the opposite direction. Different bug types have different speeds.
- Implementation: `Bug.ts` — `WANDER` and `FLEE` states. Wander picks random grid target and moves toward it. Flee calculates direction away from player and runs. Speed varies per bug type.
- Status: **Working on desktop** — speeds were reduced 40-50% for a calmer feel. Unverified on mobile.

**Bug personality art**
- Intent: 5 unique bugs drawn with Phaser Graphics, each visually distinct with personality.
- Implementation: `Bug.ts` `redraw()` method — draws each bug type with custom shapes:
  - Shades (cockroach): brown body, tiny sunglasses, smug smirk
  - Dusty (bark scorpion): tan, pincers, curled segmented tail
  - DJ Beetle (palo verde beetle): dark body, iridescent green shimmer, huge antennae
  - Neon Moth: pulsing pink/green wing triangles, ball-tip antennae
  - Tiny Tim (ant): tiny red, 3 body segments, white dot on back, 0.6x scale
- Status: **Working** — art is placeholder quality but each bug is distinct.

**Bug name labels**
- Intent: Bug's name appears floating above it when player is within ~2.5 grid tiles.
- Implementation: `PaloVerdeLane.ts` draws name text near bug position when proximity check passes.
- Status: **Unverified** — was working in earlier builds, unclear if still functioning after the deep audit.

### Catch Mechanics

**Catch ring timing game**
- Intent: Tap near a revealed bug to activate a pulsing ring. Ring goes from large to small. Tap when ring is in the green zone (small) to catch. Miss = bug gets a speed boost and runs.
- Implementation: `PaloVerdeLane.ts` — `handlePointerDown` checks tap proximity to revealed bugs (2 grid tiles). Sets `catchActive=true` and locks `catchTarget`. `updateCatchGame` draws the pulsing ring. Second tap evaluates timing.
- Status: **Broken/Unverified** — Travis reported catch circles don't appear until second tap, and stay visible when bug is far away. The deep audit rewrote this system: ring should now appear on first tap, lock to target, cancel if bug > 3 tiles away. This was deployed but never confirmed working by Travis.
- Bug history: This system has been rewritten at least 4 times. Issues included: ring showing for hidden bugs, ring never appearing, ring not canceling when bug flees, proximity checks using wrong coordinate space.

**Catch card popup**
- Intent: Full-screen card overlay on successful catch showing bug name, illustration (emoji placeholder), fun fact, rarity badge, and "Got it!" dismiss button.
- Implementation: `components/CatchCard.tsx` — React component. Listens to `eventBus` for `showCatchCard` events from Phaser. Shows dark overlay with white card.
- Status: **Unverified** — component exists and was working in earlier builds. Unclear if the event is still being emitted correctly after the catch mechanic rewrites.
- Fun facts per bug:
  - Shades: "Cockroaches can hold their breath for 40 minutes and survive a week without their head!"
  - Dusty: "Bark scorpions glow bright blue under UV light. That's how real pest techs find them at night!"
  - DJ Beetle: "Palo verde beetles can grow up to 4 inches long — they're one of the biggest beetles in North America!"
  - Neon Moth: "Some moths navigate by moonlight and can detect a single pheromone molecule from miles away!"
  - Tiny Tim: "Harvester ants can carry 50 times their own body weight. That's like you lifting a car!"

### Map and Environment

**Continuous 20x20 isometric map**
- Intent: One large seamless map for Palo Verde Lane. No screen transitions within a zone. Continuous scrolling.
- Implementation: `PaloVerdeLane.ts` — 20x20 grid of isometric diamond tiles. Objects placed at fixed grid positions: 5 houses, Moxie HQ building, 10 saguaro cacti, 8 palo verde trees, 7 rock piles, 8 bushes, 10 bug spawn points.
- Status: **Working** — map renders and is explorable. Replaced an earlier 4-screen transition system.

**Border wall**
- Intent: Natural rock/cactus/bush border around the playable area to prevent the map from looking like a floating diamond. Gaps at exit points.
- Implementation: `PaloVerdeLane.ts` `drawBorderWall()` — draws rocks, barrel cactus clusters, and desert wall segments around the grid perimeter. Gaps at 3 exit positions.
- Status: **Partially working** — border renders but the art is rough placeholder quality. The border helps contain the map visually but the contrast between tile colors and background color outside the border is still noticeable.

**Distant scenery**
- Intent: Mesa/mountain silhouettes and faded desert objects beyond the border to give depth.
- Implementation: `PaloVerdeLane.ts` `drawDistantScenery()` — draws 40+ scattered rocks, bushes, distant saguaros with progressive fade.
- Status: **Working** — objects render beyond the border.

**Background color**
- Intent: Canvas background matches ground tile color so no seams are visible.
- Implementation: `game/main.ts` `backgroundColor: '#DEB882'`. `PaloVerdeLane.ts` draws a massive fill rect behind everything.
- Status: **Partially working** — backgroundColor was changed multiple times. Currently set to '#DEB882' in main.ts. However, there's a sky gradient overlay and the CSS background may not match. Travis still saw color mismatches (salmon/red, then light blue). The deep audit set it but the result on mobile is unverified.
- Bug history: backgroundColor was '#87CEEB' (sky blue), then '#E8C99A' (sand), then '#DEB882'. Multiple worktree branches had different values, causing confusion about which was deployed.

**Zone exit points**
- Intent: Signs at 3 map edges (Coyote Wash, Ironwood Trail, Rattlesnake Ridge). Walking to an exit triggers a loading screen transition.
- Implementation: `PaloVerdeLane.ts` `drawExitMarkers()` and `checkExitZones()` — draws signpost text, checks player proximity, triggers fade overlay then scene restart.
- Status: **Partially working** — signs render and transitions trigger, but they currently just reload the same map. No other zones exist yet.

**Player movement clamping**
- Intent: Player cannot walk past the border wall boundary. Only exit gaps allow through.
- Implementation: `PaloVerdeLane.ts` `clampToPlayArea()` — callback-based boundary system in Player class.
- Status: **Unverified** — added in the border wall update but not confirmed on device.

### UI

**Bug Book**
- Intent: Overlay showing all caught bugs with their names and illustrations.
- Implementation: `components/BugBook.tsx` — React component toggled by the "Bug Book (N)" button. Listens to eventBus for catch events.
- Status: **Partially working** — button renders in top-right corner. Opens/closes on tap. Whether it correctly tracks caught bugs across the current session is unverified.

**"Bugs caught: N" counter**
- Intent: HUD element top-left showing count of caught bugs.
- Implementation: `PaloVerdeLane.ts` — Phaser text element drawn at fixed screen position.
- Status: **Working** — renders on load.

**"Hold to move, tap to catch!" hint**
- Intent: Shows on first load, fades after ~3 seconds.
- Implementation: `PaloVerdeLane.ts` — text with tween alpha animation.
- Status: **Working** — visible on load, fades appropriately.

**Landscape orientation lock**
- Intent: Show "Rotate your phone" overlay when device is in portrait mode.
- Implementation: `app/page.tsx` `.rotate-overlay` div + `app/globals.css` `@media (orientation: portrait)` rules. CSS animation of phone icon.
- Status: **Unverified** — CSS is in place but was never confirmed working on a real phone in portrait mode.

**"Palo Verde Lane" zone label**
- Intent: Show current zone name at top of screen.
- Implementation: `PaloVerdeLane.ts` — Phaser text at top-center.
- Status: **Working**

### Player Character

**Visual design**
- Intent: Moxie technician in correct brand uniform (light blue shirt, navy pants, black Moxie cap with diamond logo, bug net).
- Implementation: `game/objects/Player.ts` `redraw()` — draws character with Phaser Graphics. Green uniform (incorrect per brand manual), hat, net.
- Status: **Working but incorrect** — the character uses green (#2D6A4F) for the uniform instead of the correct Moxie light blue. Per the brand manual, the uniform should be light blue shirt (#7BB8E0 area), navy pants (#123250), black cap with Moxie Blue diamond logo.
- Note: Concept art was created in `public/concept_art_moxie_tech.html` and `public/concept_art_v2.html` with correct brand colors. Travis approved the Shades cockroach design but none of the 4 technician designs. He wants proportions closer to Sneaky Sasquatch characters (long thin limbs, round body).

**Walking animation**
- Intent: Bob up/down while moving, lean in movement direction.
- Implementation: `Player.ts` — body offset and lean applied during `redraw()` when moving.
- Status: **Unverified** — was implemented in the game feel pass but unclear if still working after subsequent rewrites.

### Branding

**Moxie HQ building**
- Intent: Moxie office building on the map with the company's teal/green color and logo.
- Implementation: `PaloVerdeLane.ts` `drawMoxieHQ()` — draws isometric building with Moxie color scheme.
- Status: **Working** — renders on map with "MOXIE HQ" label.

**Moxie brand colors**
- Intent: Use correct brand hex values from the Moxie Brand Manual.
- Key colors: Moxie Blue #0C77D8, Navy #123250, Green (Lawn Care) #008D1A, Dark Gray #374D66, Mid Gray #BEC9D8, Light Gray #E6ECEC
- Status: **Not yet applied** — the game currently uses a mix of arbitrary greens and browns. The correct Moxie brand colors have been documented in memory but not integrated into the game art.

---

## 3. Tech Stack and Architecture

### Framework
- **Next.js 16.2.1** (App Router, TypeScript) — hosts the game page and React overlay components
- **Phaser.js 3.90.0** — 2D game engine, handles rendering, input, animations
- **React 19.2.4** — UI overlay components (Bug Book, Catch Card, orientation lock)
- **TypeScript 5** — type checking

### Architecture Pattern
- Phaser game runs inside a `<canvas>` element managed by `components/GameCanvas.tsx`
- GameCanvas dynamically imports Phaser (SSR-safe) and creates the game instance
- React components (`BugBook.tsx`, `CatchCard.tsx`) overlay the canvas as HTML elements
- Communication between Phaser and React uses a custom event bus (`game/eventBus.ts`)

### Key Files
| File | Role |
|------|------|
| `game/main.ts` | Phaser game configuration (scale mode, physics, background color) |
| `game/constants.ts` | Grid size, isometric projection math, color palette, catch radius |
| `game/eventBus.ts` | Phaser <-> React communication bridge |
| `game/types.ts` | TypeScript type definitions |
| `game/scenes/PaloVerdeLane.ts` | Main game scene — map drawing, bug spawning, catch game, camera, input handling. This is the largest and most complex file (~700+ lines) |
| `game/objects/Player.ts` | Player character — position, movement, drawing, animation |
| `game/objects/Bug.ts` | Bug class — AI states, drawing, hidden/reveal, species definitions |
| `game/objects/VirtualJoystick.ts` | Legacy virtual joystick (no longer used, may still be imported) |
| `components/GameCanvas.tsx` | Dynamic Phaser loader, SSR-safe |
| `components/BugBook.tsx` | Bug collection overlay |
| `components/CatchCard.tsx` | Catch celebration card overlay |
| `app/page.tsx` | Main page — renders GameCanvas, BugBook, CatchCard, rotate overlay |
| `app/globals.css` | Global styles, orientation lock CSS, iOS bounce prevention |
| `app/layout.tsx` | Next.js layout with viewport meta tags |

### Hosting and Deployment
- **GitHub:** `travisvnick/moxie-bug-patrol` (public repo)
- **Vercel:** `moxie-bug-patrol.vercel.app` — auto-deploys from `main` branch
- **Vercel account:** travisvnick's projects (Hobby tier)
- GitHub CLI authenticated on the Mac mini via `gh auth login`

### State Management
- All game state is in-memory within the Phaser scene (no persistence)
- No Supabase integration yet (planned for Phase 2)
- No localStorage save system yet

### Build
- `npm run dev` — development server on port 3000
- `npm run build` — production build (must pass clean before deploy)
- Pushing to `main` branch auto-triggers Vercel deployment

---

## 4. Full Bug and Issue History

### 1. Virtual joystick not working on mobile
- **What:** The original joystick control didn't register touch input properly. Coordinates were misaligned with the camera zoom.
- **What we tried:** Multiple rewrites of VirtualJoystick.ts, converting screen coords to world coords.
- **Resolution:** Replaced joystick entirely with tap-to-move system (like Sneaky Sasquatch).
- **Verified:** Travis confirmed tap-to-move works. Joystick code still exists in codebase but unused.
- **Status:** Resolved (by removing the feature)

### 2. Everything too small on mobile
- **What:** At phone resolution (~390px wide), the isometric tiles, player, and bugs were tiny and unplayable.
- **What we tried:** Camera zoom at 2x (too close), 1.3x (better), 1.2x (tested).
- **Resolution:** Set to 1.3x zoom on screens < 800px width.
- **Verified:** Travis said it was "better" but centering was still off.
- **Status:** Partially resolved — zoom level may still need tuning

### 3. Player not centered on screen
- **What:** Player character slowly drifted downward over time, eventually walking off the bottom of the visible area.
- **What we tried:** Manual scrollX/scrollY math, Phaser startFollow() with invisible rect proxy, direct assignment.
- **Resolution:** Deep audit removed broken startFollow() (was following a default {x:0,y:0} with lerp, fighting manual overrides). Replaced with direct camera positioning each frame.
- **Verified:** Verified visually on Mac mini desktop. NOT verified on Travis's phone.
- **Status:** Unverified on mobile

### 4. Blue/colored borders visible around map
- **What:** Phaser canvas backgroundColor was sky blue (#87CEEB), visible on the sides of the game on wide mobile screens.
- **What we tried:** Changed to #E8C99A (sand), then #DEB882 (darker sand). Multiple merges conflicted.
- **Resolution:** Set to #DEB882 in main.ts. Added massive background fill rect.
- **Verified:** Partial — desktop shows sand color. Travis reported seeing salmon/red on his phone. A critical fix was pushed to a worktree branch (claude/distracted-faraday) and wasn't merged to main for a long time. Eventually merged.
- **Status:** Unverified on mobile — may still be wrong

### 5. Catch circles appearing for hidden bugs
- **What:** The timing ring was rendering near bugs that hadn't been revealed yet.
- **What we tried:** Added `bug.hidden` check in catch game logic.
- **Resolution:** Fixed the guard condition (was checking `!bug.reveal` which is always truthy since reveal is a method).
- **Verified:** On desktop only.
- **Status:** Resolved

### 6. Catch circles stuck on Moxie HQ
- **What:** A catch timing ring was permanently visible on the Moxie HQ building.
- **What we tried:** Rewrote catch activation logic with explicit catchActive flag.
- **Resolution:** Deep audit completely rewrote the catch system.
- **Verified:** On desktop only.
- **Status:** Likely resolved but unverified on mobile

### 7. Bugs visible on load
- **What:** Tiny Tim was appearing immediately when the game loaded because spawn point was 1.41 grid tiles from player start.
- **What we tried:** Moved spawn point from [11,11] to [6,16].
- **Resolution:** Spawn point moved.
- **Verified:** On desktop only — no bug visible on load.
- **Status:** Resolved

### 8. "Tap to catch" text stuck on screen
- **What:** Catch prompt text appeared at bottom of screen on load and never went away.
- **What we tried:** Set initial alpha to 0, explicitly hide during transitions.
- **Resolution:** Hidden on init.
- **Verified:** On desktop.
- **Status:** Likely resolved

### 9. Floating diamond map (no ground blending)
- **What:** The isometric tile grid looked like a diamond floating in empty space.
- **What we tried:** Extended background fill rects, changed background colors, added border wall and distant scenery.
- **Resolution:** Added rock/cactus border wall around grid perimeter + distant scenery objects.
- **Verified:** On desktop — border visible, distant objects render.
- **Status:** Partially resolved — the color contrast between tiles and background is still visible. The border helps but doesn't fully solve it.

### 10. Catch ring not appearing at all
- **What:** After the "fix hidden bugs" update, catch rings stopped appearing entirely.
- **What we tried:** Debugged activation logic. Found that `updateCatchGame` was resetting `catchActive=false` every frame because the bug was fleeing out of radius.
- **Resolution:** Deep audit rewrote catch system — ring locks to target once activated, only cancels if bug > 3 grid tiles away.
- **Verified:** Code reviewed but NOT tested on device.
- **Status:** Unverified

### 11. Catch ring staying visible at long distance
- **What:** Travis reported catch circles staying up and allowing catches even when the bug was far away.
- **What we tried:** Added 3-tile distance cancel threshold.
- **Resolution:** Part of the deep audit rewrite.
- **Verified:** NOT tested on device.
- **Status:** Unverified

### 12. Worktree branches not merging to main
- **What:** Claude Code tasks were creating worktree branches (claude/*) instead of committing directly to main. Vercel only deploys from main, so fixes went to Preview URLs instead of production.
- **What we tried:** Explicitly instructing tasks to work on main branch. Manually merging branches after the fact.
- **Resolution:** Ongoing issue. Each task prompt now includes "Work on main branch directly, NOT a worktree."
- **Status:** Persistent issue — needs vigilance

### 13. Permission prompts blocking code tasks
- **What:** Every Claude Code task required dozens of "Allow" permission clicks, making Travis babysit the Mac mini.
- **What we tried:** Multiple approaches to set bypassPermissions mode.
- **Resolution:** Wrote `~/.claude/settings.json` with `permissionMode: bypassPermissions` and wildcard allow rules.
- **Verified:** Subsequent tasks ran without prompting.
- **Status:** Resolved

---

## 5. Unfinished Work

### Discussed and Designed but Not Built

**Joel as NPC mentor**
- Joel Maynerich ("The Ahwatukee Bug Guy") at Moxie HQ giving welcome dialog, missions, tips
- Walkie-talkie check-ins during exploration
- "Tukee Bug Report" intel mechanic
- Joel's challenges as optional side quests
- Source material: Ahwatukee Launch Plan document (in email and Downloads folder)

**Ahwatukee setting**
- Retheme from "Copper Creek" to real Ahwatukee neighborhoods
- Zones: Lakewood, Mountain Park Ranch, South Mountain Trails, Club West, The Wash, Old Mine Ridge
- Real landmarks as game locations
- Multi-market architecture (config-based zone swapping for different cities)

**Scorpion King final boss**
- Massive bark scorpion boss in the Old Mine Ridge zone
- Multi-step encounter, Joel backstory connection

**Sound and audio**
- Catch sounds, bug reveal sounds, footstep sounds
- Desert ambient audio (coyote howls, wind, quail calls)
- Zone-specific background music
- Web Audio API implementation

**Save progress (localStorage)**
- Persist caught bugs between sessions
- Planned for Phase 2 with Supabase backend

**Supabase integration**
- Player accounts (name + short code, no email for kids)
- Cloud save data syncing across devices
- Leaderboards
- Supabase project exists: moxie-travis org, moxie-observations project

**Second zone (Coyote Wash)**
- Dry wash nature preserve, seasonal creek, hiking trails, boulders
- Different bug types than Palo Verde Lane
- Currently exit points exist but just reload same map

**Event mini-games**
- Standalone quick-play games for Joel's community event booth
- "Catch the Scorpion" speed challenge, "Spray the Roaches" whack-a-mole
- Same art style, separate entry points within the app
- QR code linking to full game

**PWA (Progressive Web App)**
- Install to iPad/Chromebook home screen
- Offline play capability
- App icon

**Art upgrade — flat vector cartoon style**
- Travis approved flat vector cartoon direction (Sneaky Sasquatch style)
- Shades cockroach concept approved
- Technician character: 4 designs rejected. Travis wants long thin limbs like actual Sneaky Sasquatch characters.
- Concept art files in `public/concept_art_moxie_tech.html` and `public/concept_art_v2.html`
- Moxie brand manual reviewed — correct colors documented (Blue #0C77D8, Navy #123250, etc.)

**Full bug roster (50+ bugs)**
- GDD describes 4 rarity tiers: Common (20), Uncommon (15), Rare (10), Legendary (5)
- Only 5 bugs currently implemented
- Full Arizona-native roster planned: bark scorpions, palo verde beetles, sun spiders, tarantula hawks, crickets, blister beetles, kissing bugs, etc.

**Bug Book (full version)**
- Currently just a list. Planned: Pokédex-style entries with illustrations, descriptions, fun facts, completion percentage

**Day/night cycle and monsoon season**
- Different bugs spawn at different times
- Monsoon weather event triggers rare bug spawns
- Heat waves as weather mechanic

### Started but Abandoned

**4-screen transition system**
- Built a Zelda-style screen transition system with fade-to-black
- Travis didn't like it — wanted continuous scrolling like Sneaky Sasquatch
- Removed and replaced with single continuous 20x20 map
- Code was deleted but exists in git history

**Virtual joystick**
- Built, debugged multiple times, ultimately replaced with tap-to-move
- `game/objects/VirtualJoystick.ts` still exists in the codebase but is unused
- Should be deleted

**NET! button**
- Separate on-screen button for catching
- Removed when catch mechanic changed to tap-on-bug

---

## 6. File Map

### Root
| File | Description | Related Features |
|------|-------------|-----------------|
| `package.json` | Dependencies: Next.js 16, Phaser 3.90, React 19, TypeScript 5 | All |
| `tsconfig.json` | TypeScript configuration | All |
| `next.config.ts` | Next.js configuration | Hosting |
| `.gitignore` | Git ignore rules | Infrastructure |
| `README.md` | Auto-generated Next.js readme | — |
| `AGENTS.md` | Claude Code agent instructions | Development |
| `CLAUDE.md` | Claude Code project context | Development |

### `app/` — Next.js App Router
| File | Description | Related Features |
|------|-------------|-----------------|
| `app/layout.tsx` | Root layout with viewport meta tags (pinch zoom disabled, user-scalable=no) | Mobile viewport |
| `app/page.tsx` | Main page — renders GameCanvas, BugBook button, CatchCard overlay, rotate overlay div | All UI |
| `app/globals.css` | Global styles — iOS bounce prevention, orientation lock media queries, body styling | Landscape lock, mobile |
| `app/favicon.ico` | Default Next.js favicon | — |

### `components/` — React UI Overlays
| File | Description | Related Features |
|------|-------------|-----------------|
| `components/GameCanvas.tsx` | Dynamic Phaser import (SSR-safe), creates game instance, manages lifecycle | Core game rendering |
| `components/BugBook.tsx` | Bug collection overlay — shows caught bugs, toggled by button | Bug Book feature |
| `components/CatchCard.tsx` | Full-screen catch celebration card — bug name, emoji, fun fact, rarity, dismiss button | Catch card popup |

### `game/` — Phaser Game Logic
| File | Description | Related Features |
|------|-------------|-----------------|
| `game/main.ts` | Phaser.Game config — RESIZE scale mode, background color '#DEB882', scene registration | Core game setup |
| `game/constants.ts` | GRID_SIZE (20), TILE_W/H (48/24), color palette, isometric math (gridToScreen, screenToGrid), catch radius, speeds | All game systems |
| `game/eventBus.ts` | EventEmitter for Phaser<->React communication (emitShowCatchCard, emitBugCaught, etc.) | Catch card, Bug Book |
| `game/types.ts` | TypeScript interfaces and types | All |
| `game/scenes/PaloVerdeLane.ts` | THE main scene file (~700+ lines). Contains: map tile drawing, all object placement (houses, cacti, trees, rocks, bushes, Moxie HQ), bug spawn system, catch game logic, camera management, input handling, border wall, distant scenery, exit zones, HUD elements | Everything |
| `game/objects/Player.ts` | Player class — grid position, world position, movement (moveTo, keyboard), drawing (green uniform, hat, net, walk animation), boundary callback | Movement, character |
| `game/objects/Bug.ts` | Bug class — 5 species definitions with speeds/facts/rarity, HIDDEN/WANDER/FLEE states, reveal(), redraw() with unique art per species, proximity detection | Bugs, catching |
| `game/objects/VirtualJoystick.ts` | LEGACY — virtual joystick, no longer used. Should be deleted. | None (dead code) |

### `public/` — Static Assets
| File | Description | Related Features |
|------|-------------|-----------------|
| `public/concept_art_moxie_tech.html` | Concept art page — original technician + Shades cockroach SVG illustrations | Art direction |
| `public/concept_art_v2.html` | 3 alternative technician designs (Chibi, Athletic, Rounded) — all rejected by Travis | Art direction |
| `public/file.svg` | Default Next.js asset | — |
| `public/globe.svg` | Default Next.js asset | — |
| `public/next.svg` | Default Next.js asset | — |
| `public/vercel.svg` | Default Next.js asset | — |
| `public/window.svg` | Default Next.js asset | — |

---

## Additional Context

### Related Documents
- **Game Design Document:** `~/Desktop/Gary/Projects/Moxie_Bug_Patrol_GDD.docx` — comprehensive GDD with world design, bug roster, progression system, tech architecture, development roadmap. Last updated to Copper Creek setting (needs Ahwatukee update).
- **Ahwatukee Launch Plan:** Downloaded to `~/Downloads/Ahwatukee Launch Plan.docx` — Joel's marketing strategy, weekly playbook, deliverables list.
- **Joel's assets:** In Gary's Gmail (gary@travisvnichols.com) — A-frame signs, business cards, family photo. 8 PNG attachments.
- **Moxie Brand Manual:** `~/Desktop/Gary/Resources/Moxie-Brand-Manual_08.19.2025.pdf` — 76 pages, full brand guidelines including colors, logo rules, typography, uniform specs.

### Accounts and Access
- **GitHub:** travisvnick — `gh auth login` completed on Mac mini
- **Vercel:** travisvnick's projects (Hobby tier) — connected to GitHub, auto-deploys from main
- **Supabase:** moxie-travis org (Free tier) — project moxie-observations exists, no game project yet
- **Gmail:** gary@travisvnichols.com — Gary's (the agent's) email, logged in via Chrome
- **Mac mini:** All dev work in `~/Desktop/Gary/Projects/`
- **Claude Code permissions:** `~/.claude/settings.json` set to `bypassPermissions` mode

### Critical Lessons Learned
1. **Test before shipping.** Multiple broken builds were sent to Travis. Always run `npm run build`, check console errors, and visually verify before pushing.
2. **Worktree branches don't auto-deploy.** Always specify "work on main branch directly" in task prompts. Verify the commit went to main, not a claude/* branch.
3. **Mobile testing is essential.** Desktop looks different from phone. The Chrome mobile emulator doesn't fully replicate touch behavior. Coordinate spaces change with zoom.
4. **The catch mechanic is fragile.** It's been rewritten 4+ times. The core issue is coordinate space conversion between screen pixels, world coords, and grid coords, compounded by camera zoom. Next implementer should write unit tests for the proximity checks.
5. **PaloVerdeLane.ts is too big.** It handles map drawing, object placement, input, catch game, camera, exits, borders, scenery — all in one file. Should be decomposed.
