# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Open `index.html` directly in a browser (double-click or `open index.html`). There are no dependencies, bundlers, or package managers.

URL params:
- `?gravity=1` — start in gravity/N-body screen instead of the default game screen
- `?debug=1` — enable debug overlays

## Architecture

All game logic lives in `js/GlidePath.js` inside a single IIFE namespace `glide_path()`. `js/utils.js` contains only static pre-recorded data (no logic beyond `GetGroundCoords()`).

### Two screens

`GravityEnabled()` (returns `gGravityGameActive`) determines which mode is active. `SwitchScreens()` toggles between them; clicking the ship logo calls it.

- **Game screen** (default, `gGravityGameActive = false`): scrolling top/bottom terrain, fly the ship between the walls for score. Ground segments scroll right-to-left from pre-recorded arrays in `utils.js`.
- **Gravity screen** (`gGravityGameActive = true`, URL `?gravity=1`): N-body gravity simulation with `gNumGravityObjects` draggable blobs. The ship sits fixed in the center.

### Game loop

`requestAnimationFrame` → `EventLoop()` → `DoOneFrame()`, which runs every frame in order:
`ClearCanvas` → `DrawMiniMap` → `DrawAndUpdateGround` → `CalcRotationTime` → `CheckEnterSimulationMode` → `GetUserInput` → `DoObjectPairInteractions` → `CheckShipWithinLines` → `AnimateAndDrawObjects` → `CheckResetGravity` → `DoGame` → `DrawText` → `ShowScoreStats`

### Object system

Every entity (ship, gravity blobs, ground segments, bullets, explosions, text bubbles) is an instance of the `Object` class and lives in `gObjects[]`. `Object.update(deltaMS)` integrates velocity/acceleration, handles collision death, and calls the appropriate draw function. Gravity objects are also tracked in `gGravityObjects[]`; ground segments in `gGroundObjectsBottom[]` and `gGroundObjectsTop[]`.

### Key globals

| Variable | Purpose |
|---|---|
| `gShipObject` | The player ship |
| `gGameState` | State machine: `eWaitingForStart / eStarting / eStarted / eEnded / eInactive` |
| `gSimulationMode` | Auto-pilot using pre-recorded `gShipHistArray` (demo when idle) |
| `gScore` / `gBestScore` | Scoring |
| `gCapturingHistory` | Set to `true` to record new ship/ground data to console |

### utils.js

Contains only static data consumed by GlidePath.js:
- `gShipHistArray` — pre-recorded ship positions/angles for simulation/demo mode (`ShipHist` objects: x, y, angle, thrusting)
- `gGroundArrayBottom` / `gGroundArrayTop` — pre-recorded ground segment dimensions (`GroundObj` objects: w, h) cycled via `GetGroundCoords()`

### Scoring (game screen)

Points accumulate while `gShipDistanceFromGround < kDistanceGameScoreCutoff` (48 px) and for completing 360° rotations. Ship collision with ground ends the run.

### Controls (game screen)

Left/right arrow keys rotate; up arrow or `Z` thrusts; `X` shoots. Mouse drag moves gravity objects (gravity screen) or any object (game screen).
