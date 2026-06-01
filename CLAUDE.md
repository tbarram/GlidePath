# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

`npm run dev` starts the Vite dev server. Or open `index.html` directly in a browser.

## Architecture

GlidePath is a **real-time audio motion design tool**. Nodes (spheres) on a canvas interact through N-body gravity physics, and their movement parameters drive an audio synthesis engine to create motion-simulated sound.

### Core concept

Each node is one of three types:
- **Source** — generates sound (audio file, note, scale, or noise). Can be static, spatial-aware, time-aware, or random.
- **Envelope** — modulates source parameters (amplitude, pitch, filter, pan) based on movement/gravity interactions.
- **Effect** — processes audio (reverb, echo, flanger, filter, compressor) with parameters driven by spatial/motion data.

### File structure

| File | Purpose |
|---|---|
| `js/GlidePath.js` | Physics engine & canvas renderer (IIFE). N-body gravity, node rendering, mouse drag interaction. Exposes `window.GlidePath` state object and `window.GlidePathAddNode/RemoveNode/ClearNodes/SyncNode/SetVisualPaused/SetShowTrails` APIs. |
| `js/audio.js` | Web Audio API engine. Renders per-node audio based on physics state. Handles recording to WAV. Runs on audio thread via ScriptProcessorNode. |
| `js/sidebar.js` | UI sidebar (ES module). Node configuration panel — add/remove/configure nodes, presets, play/pause/record controls. |
| `js/main.js` | Entry point (ES module). Connects sidebar, audio engine, and physics canvas via requestAnimationFrame loop. |
| `js/recording-worklet.js` | AudioWorklet for recording output to WAV. |

### Data flow

1. `GlidePath.js` runs physics simulation, exposes `window.GlidePath` with per-node position/velocity/acceleration/interaction data each frame.
2. `main.js` reads `window.GlidePath` on each rAF tick and calls `renderAudio(state, params)`.
3. `audio.js` maps each node's physics data to audio parameters based on the node's configuration in `params.nodes[]`.
4. `sidebar.js` provides the UI for configuring nodes and calls `window.GlidePathAddNode` etc. to sync visual nodes on canvas.

### Controls

- **Add Node** — creates a new source node on canvas
- **Freeze/Move** — pauses/resumes physics simulation
- **Trails** — toggle motion trails on nodes
- **Clear** — removes all nodes
- **Play/Pause** — starts/stops audio engine
- **Record/Stop** — records output to WAV file
- **Copy** — copies current params as JSON

Mouse drag moves nodes on canvas to experiment with gravitational interactions in real-time.
