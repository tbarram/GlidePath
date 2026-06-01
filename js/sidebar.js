import { Pane } from 'tweakpane';

const SIDEBAR_CSS = `
  #synth-sidebar {
    position: fixed;
    display: flex;
    flex-direction: column;
    background: rgba(11, 11, 11, 0.93);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 1.35rem;
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.52);
    z-index: 9999;
    font-family: 'Courier New', monospace;
    color: #fff;
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1),
                opacity 0.25s cubic-bezier(0.4,0,0.2,1);
    overflow: hidden;
    user-select: none;
  }

  #synth-sidebar.synth-position-right,
  #synth-sidebar.synth-position-left {
    top: 12px;
    bottom: 12px;
    width: 290px;
    max-height: calc(100vh - 24px);
  }

  #synth-sidebar.synth-position-right { right: 12px; }
  #synth-sidebar.synth-position-left { left: 12px; }

  #synth-sidebar.synth-position-top,
  #synth-sidebar.synth-position-bottom {
    left: 50%;
    width: min(760px, calc(100vw - 24px));
    max-height: min(460px, calc(50vh - 18px));
    transform: translateX(-50%);
  }

  #synth-sidebar.synth-position-top { top: 12px; }
  #synth-sidebar.synth-position-bottom { bottom: 12px; }

  #synth-sidebar.synth-hidden {
    opacity: 0;
    pointer-events: none;
  }

  #synth-sidebar.synth-position-right.synth-hidden {
    transform: translateX(calc(100% + 24px));
  }

  #synth-sidebar.synth-position-left.synth-hidden {
    transform: translateX(calc(-100% - 24px));
  }

  #synth-sidebar.synth-position-top.synth-hidden {
    transform: translate(-50%, calc(-100% - 24px));
  }

  #synth-sidebar.synth-position-bottom.synth-hidden {
    transform: translate(-50%, calc(100% + 24px));
  }

  .synth-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px 11px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
    cursor: default;
  }

  .synth-title {
    flex: 1;
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.88);
  }

  .synth-mode-badge {
    font-size: 9px;
    padding: 2px 8px;
    border-radius: 99px;
    background: rgba(242, 106, 27, 0.15);
    color: #f26a1b;
    border: 1px solid rgba(242, 106, 27, 0.3);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    transition: background 0.3s, color 0.3s;
  }

  .synth-mode-badge.gravity-mode {
    background: rgba(96, 165, 250, 0.15);
    color: #60a5fa;
    border-color: rgba(96, 165, 250, 0.3);
  }

  .synth-position-toggle {
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 99px;
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.55);
    cursor: pointer;
    font-size: 12px;
    padding: 3px 7px;
    line-height: 1;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .synth-position-toggle:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.18);
    color: rgba(255,255,255,0.9);
  }

  .synth-toggle {
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    font-size: 16px;
    padding: 2px 4px;
    line-height: 1;
    transition: color 0.15s;
  }
  .synth-toggle:hover { color: rgba(255,255,255,0.85); }

  .synth-status-bar {
    height: 3px;
    flex-shrink: 0;
    background: rgba(255,255,255,0.04);
    position: relative;
    overflow: hidden;
  }

  .synth-status-bar-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #f26a1b, #f59e0b);
    transition: width 0.05s linear;
  }

  .synth-pane-host {
    flex: 1;
    overflow-y: auto;
    padding: 6px 6px 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.08) transparent;
    /* Tweakpane CSS variable overrides */
    --tp-base-background-color: transparent;
    --tp-base-shadow-color: transparent;
    --tp-button-background-color: rgba(255,255,255,0.09);
    --tp-button-background-color-active: rgba(242,106,27,0.9);
    --tp-button-background-color-hover: rgba(255,255,255,0.15);
    --tp-button-foreground-color: rgba(255,255,255,0.9);
    --tp-container-background-color: rgba(255,255,255,0.045);
    --tp-container-background-color-hover: rgba(255,255,255,0.07);
    --tp-container-foreground-color: rgba(255,255,255,0.88);
    --tp-container-unit-size: 28px;
    --tp-input-background-color: rgba(255,255,255,0.07);
    --tp-input-background-color-focus: rgba(255,255,255,0.13);
    --tp-input-background-color-hover: rgba(255,255,255,0.11);
    --tp-input-foreground-color: rgba(255,255,255,0.92);
    --tp-label-foreground-color: rgba(255,255,255,0.45);
    --tp-monitor-background-color: rgba(0,0,0,0.22);
    --tp-monitor-foreground-color: rgba(242,106,27,0.88);
    --tp-blade-spacing: 4px;
    --tp-blade-unit-size: 26px;
  }

  .synth-pane-host .tp-dfwv {
    width: 100% !important;
  }

  .synth-footer {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }

  .synth-footer-row {
    display: flex;
    gap: 6px;
  }

  #synth-mode-btn {
    width: 100%;
    background: rgba(96, 165, 250, 0.18);
    border-color: rgba(96, 165, 250, 0.35);
    color: #93c5fd;
  }
  #synth-mode-btn:hover {
    background: rgba(96, 165, 250, 0.3);
    border-color: rgba(96, 165, 250, 0.5);
  }
  #synth-mode-btn:disabled {
    opacity: 0.3;
    cursor: default;
    pointer-events: none;
  }

  .synth-btn {
    flex: 1;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: rgba(255,255,255,0.85);
    font-family: 'Courier New', monospace;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 8px 10px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }
  .synth-btn:hover {
    background: rgba(255,255,255,0.14);
    border-color: rgba(255,255,255,0.2);
  }

  .synth-btn.start-active {
    background: rgba(242,106,27,0.85);
    border-color: transparent;
    color: #fff;
  }
  .synth-btn.start-active:hover { background: rgba(242,106,27,1); }

  .synth-btn.copied {
    background: rgba(34, 197, 94, 0.8);
    border-color: transparent;
    color: #fff;
  }

  #synth-open-btn {
    position: fixed;
    background: rgba(11,11,11,0.88);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 50%;
    width: 38px;
    height: 38px;
    color: #f26a1b;
    font-size: 17px;
    cursor: pointer;
    z-index: 9998;
    display: none;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: background 0.15s;
  }
  #synth-open-btn:hover { background: rgba(242,106,27,0.2); }
  #synth-open-btn.visible { display: flex; }
  #synth-open-btn.synth-position-right {
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
  }
  #synth-open-btn.synth-position-left {
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
  }
  #synth-open-btn.synth-position-top {
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
  }
  #synth-open-btn.synth-position-bottom {
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
  }
`;

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = SIDEBAR_CSS;
  document.head.appendChild(style);
}

const SIDEBAR_POSITIONS = ['right', 'left', 'top', 'bottom'];
const SIDEBAR_POSITION_LABELS = {
  right: 'Right',
  left: 'Left',
  top: 'Top',
  bottom: 'Bottom',
};
const SIDEBAR_POSITION_STORAGE_KEY = 'glidepath:synth-sidebar-position';

function sanitizeSidebarPosition(position) {
  return SIDEBAR_POSITIONS.includes(position) ? position : 'right';
}

function applySidebarPosition(sidebar, openBtn, position) {
  const nextPosition = sanitizeSidebarPosition(position);
  for (const value of SIDEBAR_POSITIONS) {
    sidebar.classList.toggle(`synth-position-${value}`, value === nextPosition);
    openBtn.classList.toggle(`synth-position-${value}`, value === nextPosition);
  }
  sidebar.dataset.position = nextPosition;
  openBtn.dataset.position = nextPosition;

  const positionBtn = document.getElementById('synth-position-btn');
  if (positionBtn) {
    positionBtn.textContent = `⇱ ${SIDEBAR_POSITION_LABELS[nextPosition]}`;
    positionBtn.title = `Move panel (currently ${SIDEBAR_POSITION_LABELS[nextPosition]})`;
  }
}

export function createSidebar() {
  injectStyles();

  // ── Build sidebar DOM ──────────────────────────────────────────────
  const sidebar = document.createElement('aside');
  sidebar.id = 'synth-sidebar';
  sidebar.innerHTML = `
    <header class="synth-header">
      <span class="synth-title">⬡ GlidePath Synth</span>
      <span class="synth-mode-badge" id="synth-mode-badge">GAME</span>
      <button class="synth-position-toggle" id="synth-position-btn" title="Move panel">⇱ Right</button>
      <button class="synth-toggle" id="synth-toggle-btn" title="Hide panel">✕</button>
    </header>
    <div class="synth-status-bar">
      <div class="synth-status-bar-fill" id="synth-level-bar"></div>
    </div>
    <div class="synth-pane-host" id="synth-pane-host"></div>
    <footer class="synth-footer">
      <button class="synth-btn" id="synth-mode-btn">⇄ Switch to GlidePath Mode</button>
      <div class="synth-footer-row">
        <button class="synth-btn" id="synth-start-btn">▶ Start Audio</button>
        <button class="synth-btn" id="synth-copy-btn">⎘ Copy Params</button>
      </div>
    </footer>
  `;
  document.body.appendChild(sidebar);

  const openBtn = document.createElement('button');
  openBtn.id = 'synth-open-btn';
  openBtn.textContent = '⬡';
  openBtn.title = 'Open synth panel';
  document.body.appendChild(openBtn);

  const storedPosition = localStorage.getItem(SIDEBAR_POSITION_STORAGE_KEY);
  applySidebarPosition(sidebar, openBtn, storedPosition);

  document.getElementById('synth-position-btn').addEventListener('click', () => {
    const currentIndex = SIDEBAR_POSITIONS.indexOf(sanitizeSidebarPosition(sidebar.dataset.position));
    const nextPosition = SIDEBAR_POSITIONS[(currentIndex + 1) % SIDEBAR_POSITIONS.length];
    localStorage.setItem(SIDEBAR_POSITION_STORAGE_KEY, nextPosition);
    applySidebarPosition(sidebar, openBtn, nextPosition);
  });

  // ── Presets ────────────────────────────────────────────────────────
  const PRESETS = {
    default: {
      masterVolume: 0.55, scale: 'aminor', baseOctave: 2, detune: 1.002,
      filterQ: 0.8, reverbMix: 0.38, flangeMix: 0.55,
      vibratoDepth: 0.010, proximityDistortion: 0.4, energyFilterScale: 1.0,
      stutterRate: 0, stutterDepth: 0, varispeedAmount: 0,
    },
    varispeedStutter: {
      masterVolume: 0.62, scale: 'aminorpenta', baseOctave: 2, detune: 1.007,
      filterQ: 3.2, reverbMix: 0.08, flangeMix: 0.80,
      vibratoDepth: 0.025, proximityDistortion: 0.75, energyFilterScale: 2.2,
      stutterRate: 13, stutterDepth: 0.82, varispeedAmount: 0.68,
    },
  };

  // ── Parameters object (shared with audio engine) ───────────────────
  const params = { ...PRESETS.default };

  // ── Build Tweakpane ────────────────────────────────────────────────
  const pane = new Pane({ container: document.getElementById('synth-pane-host') });

  // Preset selector (not included in Copy Params JSON — lives in separate object)
  const presetState = { preset: 'default' };
  pane.addBinding(presetState, 'preset', {
    label: 'Preset',
    options: { 'Default': 'default', 'Varispeed Stutter': 'varispeedStutter' },
  }).on('change', ({ value }) => {
    Object.assign(params, PRESETS[value]);
    pane.refresh();
  });

  const voiceFolder = pane.addFolder({ title: 'Voice', expanded: true });
  voiceFolder.addBinding(params, 'masterVolume', {
    label: 'Volume', min: 0, max: 1, step: 0.01,
  });
  voiceFolder.addBinding(params, 'scale', {
    label: 'Scale',
    options: {
      'A Minor': 'aminor', 'A Minor Penta': 'aminorpenta',
      'A Major': 'amajor', 'A Dorian': 'adorian', 'D Minor': 'dminor',
    },
  });
  voiceFolder.addBinding(params, 'baseOctave', {
    label: 'Base Oct', min: 1, max: 4, step: 1,
  });
  voiceFolder.addBinding(params, 'detune', {
    label: 'Detune', min: 1.0, max: 1.015, step: 0.0001,
  });

  const flangeFolder = pane.addFolder({ title: 'Trail Flanger', expanded: true });
  flangeFolder.addBinding(params, 'flangeMix', {
    label: 'Mix', min: 0, max: 1, step: 0.01,
  });
  flangeFolder.addBinding(params, 'vibratoDepth', {
    label: 'Vibrato', min: 0, max: 0.05, step: 0.001,
  });
  flangeFolder.addBinding(params, 'proximityDistortion', {
    label: 'Prox Sub', min: 0, max: 1, step: 0.01,
  });

  const stutterFolder = pane.addFolder({ title: 'Varispeed Stutter', expanded: true });
  stutterFolder.addBinding(params, 'stutterRate', {
    label: 'Rate (Hz)', min: 0, max: 30, step: 0.1,
  });
  stutterFolder.addBinding(params, 'stutterDepth', {
    label: 'Gate Depth', min: 0, max: 1, step: 0.01,
  });
  stutterFolder.addBinding(params, 'varispeedAmount', {
    label: 'Varispeed', min: 0, max: 1, step: 0.01,
  });

  const filterFolder = pane.addFolder({ title: 'Filter / Energy', expanded: false });
  filterFolder.addBinding(params, 'filterQ', {
    label: 'Base Q', min: 0.5, max: 5.0, step: 0.05,
  });
  filterFolder.addBinding(params, 'energyFilterScale', {
    label: 'Energy→Filter', min: 0, max: 3, step: 0.05,
  });

  const fxFolder = pane.addFolder({ title: 'FX', expanded: false });
  fxFolder.addBinding(params, 'reverbMix', {
    label: 'Reverb', min: 0, max: 1, step: 0.01,
  });

  // ── Wire up buttons ────────────────────────────────────────────────
  document.getElementById('synth-toggle-btn').addEventListener('click', () => {
    sidebar.classList.add('synth-hidden');
    openBtn.classList.add('visible');
  });

  openBtn.addEventListener('click', () => {
    sidebar.classList.remove('synth-hidden');
    openBtn.classList.remove('visible');
  });

  const copyBtn = document.getElementById('synth-copy-btn');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(params, null, 2));
      copyBtn.textContent = '✓ Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = '⎘ Copy Params';
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch {
      copyBtn.textContent = 'Failed';
      setTimeout(() => { copyBtn.textContent = '⎘ Copy Params'; }, 1500);
    }
  });

  document.getElementById('synth-mode-btn').addEventListener('click', () => {
    window.GlidePathSwitchScreens?.();
  });

  return { params, pane };
}

// ── Update mode badge + switch button state ──────────────────────────
export function updateModeBadge(gravityMode) {
  const badge   = document.getElementById('synth-mode-badge');
  const modeBtn = document.getElementById('synth-mode-btn');

  if (badge) {
    badge.textContent = gravityMode ? 'GRAVITY' : 'GAME';
    badge.classList.toggle('gravity-mode', gravityMode);
  }

  if (modeBtn) {
    modeBtn.textContent = gravityMode ? '⇄ Switch to GlidePath Mode' : '⇄ Switch to Gravity Mode';
  }
}

// ── Animate the proximity level bar ─────────────────────────────────
export function updateLevelBar(proximity) {
  const bar = document.getElementById('synth-level-bar');
  if (bar) bar.style.width = `${Math.round(proximity * 100)}%`;
}

// ── Toggle start button appearance ──────────────────────────────────
export function setStartButtonActive(active) {
  const btn = document.getElementById('synth-start-btn');
  if (!btn) return;
  if (active) {
    btn.textContent = '⏸ Pause Audio';
    btn.classList.add('start-active');
  } else {
    btn.textContent = '▶ Start Audio';
    btn.classList.remove('start-active');
  }
}

export function getStartButton() {
  return document.getElementById('synth-start-btn');
}
