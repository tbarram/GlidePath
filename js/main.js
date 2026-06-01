import {
  initAudio,
  isRecording,
  loadSampleForNode,
  renderAudio,
  startRecording,
  stopRecording,
  suspendAudio,
  resumeAudio,
  isInitialized,
} from './audio.js';
import {
  createSidebar,
  updateLevelBar,
  setStartButtonActive,
  setRecordButtonActive,
  getStartButton,
  getRecordButton,
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

async function ensureAudioRunning() {
  if (!isInitialized()) await initAudio();
  resumeAudio();
  audioRunning = true;
  setStartButtonActive(true);
}

function downloadRecording(blob) {
  if (!blob) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `glidepath-${timestamp}.wav`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function toggleRecording() {
  if (isRecording()) {
    const blob = stopRecording();
    setRecordButtonActive(false);
    downloadRecording(blob);
    return;
  }

  await ensureAudioRunning();
  try {
    startRecording();
    setRecordButtonActive(true);
  } catch (error) {
    console.warn('[GlidePath Recorder]', error.message);
  }
}

getRecordButton()?.addEventListener('click', toggleRecording);

window.addEventListener('glidepath:load-sample', async ({ detail }) => {
  if (!detail?.file) return;
  await ensureAudioRunning();
  await loadSampleForNode(detail.nodeIndex, detail.file);
});

// ── Main render loop: reads physics state and drives the audio engine ──
function tick() {
  requestAnimationFrame(tick);

  const gp = window.GlidePath;
  if (!gp) return;

  // Level bar: show system energy
  updateLevelBar(Math.min(1, gp.systemEnergy ?? 0));

  if (audioRunning) renderAudio(gp, params);
}

requestAnimationFrame(tick);
