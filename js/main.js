import {
  initAudio,
  renderAudio,
  suspendAudio,
  resumeAudio,
  isInitialized,
} from './audio.js';
import {
  createSidebar,
  updateModeBadge,
  updateLevelBar,
  setStartButtonActive,
  getStartButton,
} from './sidebar.js';

// ── Build the sidebar and grab the shared params object ──────────────
const { params } = createSidebar();

// ── Audio start/pause toggle ─────────────────────────────────────────
let audioRunning = false;

async function toggleAudio() {
  if (!isInitialized()) {
    await initAudio();
    audioRunning = true;
  } else if (audioRunning) {
    suspendAudio();
    audioRunning = false;
  } else {
    resumeAudio();
    audioRunning = true;
  }
  setStartButtonActive(audioRunning);
}

getStartButton()?.addEventListener('click', toggleAudio);

// ── Main render loop: reads game state and drives the synth ──────────
let lastGravityMode = null;

function tick() {
  requestAnimationFrame(tick);

  const gp = window.GlidePath;
  if (!gp) return;

  // Update mode badge whenever mode changes
  if (gp.gravityMode !== lastGravityMode) {
    updateModeBadge(gp.gravityMode);
    lastGravityMode = gp.gravityMode;
  }

  // Level bar: show system energy in gravity mode, proximity in game mode
  updateLevelBar(gp.gravityMode
    ? Math.min(1, gp.systemEnergy ?? 0)
    : (gp.proximity ?? 0)
  );

  if (audioRunning) renderAudio(gp, params);
}

requestAnimationFrame(tick);
