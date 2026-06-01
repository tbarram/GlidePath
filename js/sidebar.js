const MAX_AUDIO_NODES = 12;
const SIDEBAR_POSITIONS = ['right', 'left', 'top', 'bottom'];
const SIDEBAR_POSITION_STORAGE_KEY = 'glidepath:sidebar-position';
const SIDEBAR_POSITION_LABELS = { right: 'Right', left: 'Left', top: 'Top', bottom: 'Bottom' };

const SOURCE_OPTIONS = { Scale: 'scale', Note: 'note', Noise: 'noise', 'Audio File': 'file' };
const INSTRUMENT_OPTIONS = { Synth: 'synth', Kick: 'kick', Snare: 'snare', Hat: 'hat', Pluck: 'pluck', Bass: 'bass', Arp: 'arp' };
const RHYTHM_OPTIONS = { '1 bar': '1/1', '1/2': '1/2', '1/4': '1/4', '1/8': '1/8', '1/16': '1/16' };
const TRIGGER_OPTIONS = { None: 'none', Proximity: 'proximity', Orbit: 'orbit', Impact: 'impact' };
const ROLE_OPTIONS = { Source: 'source', Envelope: 'envelope', Effect: 'effect', Muted: 'muted' };
const BEHAVIOR_OPTIONS = { Static: 'static', Spatial: 'spatial', Time: 'time', Random: 'random', 'Spatial + Time': 'spatial-time' };
const MOVEMENT_OPTIONS = {
  Distance: 'distance',
  Interaction: 'interaction',
  Attraction: 'attraction',
  Repulsion: 'repulsion',
  Orbit: 'orbit',
  Nearness: 'near',
  Nearest: 'nearest',
  Speed: 'speed',
  Acceleration: 'acceleration',
  'X Axis': 'x',
  'Y Axis': 'y',
  Angle: 'angle',
  'Angular Velocity': 'angularVelocity',
  Energy: 'energy',
  Time: 'time',
};
const TIMING_OFFSET_OPTIONS = { None: 'none', 'Push/Pull Feel': 'pushPull', ...MOVEMENT_OPTIONS };
const TARGET_OPTIONS = Object.fromEntries([
  ['All Sources', 'sources'],
  ['General Mix', 'mix'],
  ...Array.from({ length: MAX_AUDIO_NODES }, (_, i) => [`Node ${i + 1}`, `node-${i}`]),
]);
const SCALE_OPTIONS = {
  'A Minor': 'aminor',
  'A Minor Penta': 'aminorpenta',
  'A Major': 'amajor',
  'A Major Penta': 'amajorpenta',
  'A Dorian': 'adorian',
  'A Lydian': 'alydian',
  'A Mixolydian': 'amixolydian',
  'A Phrygian': 'aphrygian',
  'A Harmonic Minor': 'aharmonicminor',
  'A Melodic Minor': 'amelodicminor',
  'A Blues': 'ablues',
  'Hirajoshi': 'hirajoshi',
  'Iwato': 'iwato',
  'Whole Tone': 'wholetone',
  'D Minor': 'dminor',
};

const SIDEBAR_CSS = `
  #synth-sidebar {
    position: fixed;
    display: flex;
    flex-direction: column;
    background: rgba(10, 11, 12, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.52);
    z-index: 9999;
    font-family: 'Courier New', monospace;
    color: #fff;
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s cubic-bezier(0.4,0,0.2,1);
    overflow: hidden;
    user-select: none;
  }

  #synth-sidebar.synth-position-right,
  #synth-sidebar.synth-position-left {
    top: 12px;
    bottom: 12px;
    width: 340px;
    max-height: calc(100vh - 24px);
  }

  #synth-sidebar.synth-position-right { right: 12px; }
  #synth-sidebar.synth-position-left { left: 12px; }

  #synth-sidebar.synth-position-top,
  #synth-sidebar.synth-position-bottom {
    left: 50%;
    width: min(840px, calc(100vw - 24px));
    max-height: min(510px, calc(60vh - 18px));
    transform: translateX(-50%);
  }

  #synth-sidebar.synth-position-top { top: 12px; }
  #synth-sidebar.synth-position-bottom { bottom: 12px; }
  #synth-sidebar.synth-hidden { opacity: 0; pointer-events: none; }
  #synth-sidebar.synth-position-right.synth-hidden { transform: translateX(calc(100% + 24px)); }
  #synth-sidebar.synth-position-left.synth-hidden { transform: translateX(calc(-100% - 24px)); }
  #synth-sidebar.synth-position-top.synth-hidden { transform: translate(-50%, calc(-100% - 24px)); }
  #synth-sidebar.synth-position-bottom.synth-hidden { transform: translate(-50%, calc(100% + 24px)); }

  .synth-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px 11px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }

  .synth-title {
    flex: 1;
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.88);
  }

  .synth-position-toggle,
  .synth-toggle {
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 99px;
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.62);
    cursor: pointer;
    font-size: 12px;
    padding: 4px 8px;
    line-height: 1;
  }

  .synth-toggle {
    border: none;
    background: none;
    font-size: 16px;
    padding: 2px 4px;
  }

  .synth-position-toggle:hover,
  .synth-toggle:hover {
    color: rgba(255,255,255,0.92);
    background: rgba(255,255,255,0.12);
  }

  .synth-status-bar {
    height: 3px;
    flex-shrink: 0;
    background: rgba(255,255,255,0.04);
    overflow: hidden;
  }

  .synth-status-bar-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #f26a1b, #60a5fa);
    transition: width 0.05s linear;
  }

  .synth-pane-host {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.12) transparent;
  }

  .node-section {
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    border-radius: 10px;
    padding: 10px;
    margin-bottom: 10px;
  }

  .node-section h3 {
    margin: 0;
    color: rgba(255,255,255,0.88);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .section-kicker {
    color: rgba(255,255,255,0.34);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .section-help {
    margin: 0 0 10px;
    color: rgba(255,255,255,0.42);
    font-size: 10px;
    line-height: 1.35;
  }

  .control-group {
    border-top: 1px solid rgba(255,255,255,0.07);
    padding-top: 8px;
    margin-top: 8px;
  }

  .control-group:first-of-type {
    border-top: none;
    padding-top: 0;
    margin-top: 0;
  }

  .control-group-title {
    margin: 0 0 5px;
    color: rgba(96,165,250,0.82);
    font-size: 9px;
    font-weight: bold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .node-row {
    display: grid;
    grid-template-columns: 98px minmax(0, 1fr) 42px;
    align-items: center;
    gap: 8px;
    min-height: 29px;
    color: rgba(255,255,255,0.58);
    font-size: 10px;
  }

  .node-row span { line-height: 1.15; }

  .node-row input[type="range"] { width: 100%; }
  .node-row input[type="checkbox"] { justify-self: start; }
  .node-row select,
  .node-row input[type="text"],
  .node-row input[type="number"] {
    width: 100%;
    min-width: 0;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    background: rgba(0,0,0,0.28);
    color: rgba(255,255,255,0.9);
    font: inherit;
    padding: 5px 6px;
  }

  .node-row output {
    color: rgba(255,255,255,0.5);
    text-align: right;
    font-size: 9px;
  }

  .synth-footer {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    border-top: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }

  .footer-label {
    color: rgba(255,255,255,0.36);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .synth-footer-row { display: flex; gap: 6px; }

  .synth-btn {
    flex: 1;
    min-width: 0;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: rgba(255,255,255,0.86);
    font-family: 'Courier New', monospace;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 8px 9px;
    cursor: pointer;
    white-space: nowrap;
  }

  .synth-btn:hover {
    background: rgba(255,255,255,0.14);
    border-color: rgba(255,255,255,0.22);
  }

  .synth-btn.start-active {
    background: rgba(242,106,27,0.85);
    border-color: transparent;
    color: #fff;
  }

  .synth-btn.record-active {
    background: rgba(220, 38, 38, 0.86);
    border-color: transparent;
    color: #fff;
  }

  .synth-btn.copied {
    background: rgba(34, 197, 94, 0.8);
    border-color: transparent;
    color: #fff;
  }

  .synth-file-row {
    display: none;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.62);
  }

  .synth-file-row.visible { display: flex; }
  .synth-file-row input { max-width: 190px; font-size: 10px; color: rgba(255,255,255,0.72); }

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
  }

  #synth-open-btn.visible { display: flex; }
  #synth-open-btn.synth-position-right { right: 12px; top: 50%; transform: translateY(-50%); }
  #synth-open-btn.synth-position-left { left: 12px; top: 50%; transform: translateY(-50%); }
  #synth-open-btn.synth-position-top { top: 12px; left: 50%; transform: translateX(-50%); }
  #synth-open-btn.synth-position-bottom { bottom: 12px; left: 50%; transform: translateX(-50%); }
`;

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = SIDEBAR_CSS;
  document.head.appendChild(style);
}

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
    positionBtn.textContent = `Move: ${SIDEBAR_POSITION_LABELS[nextPosition]}`;
    positionBtn.title = `Move panel (currently ${SIDEBAR_POSITION_LABELS[nextPosition]})`;
  }
}

function createNode(role, overrides = {}) {
  return {
    name: '',
    role,
    enabled: true,
    instrument: 'synth',
    rhythm: '1/8',
    probability: 0.65,
    timingOffsetSource: 'none',
    timingOffsetAmount: 0,
    sourceType: 'scale',
    behavior: 'spatial',
    motionParam: 'angle',
    scale: 'aminor',
    baseOctave: 4,
    waveform: 'sine',
    midiNote: 57,
    pitchDepth: 7,
    gain: 0.45,
    ampFloor: 0.72,
    filterCutoff: 8000,
    spacePan: true,
    staticPan: 0,
    movement: 'distance',
    target: 'sources',
    destination: 'amp',
    amount: 0.45,
    attack: 0.04,
    release: 0.22,
    trigger: 'none',
    triggerThreshold: 0.68,
    triggerAmount: 0.6,
    triggerDecay: 0.16,
    polarity: 'positive',
    effectType: 'reverb',
    baseMix: 0.1,
    time: 0.25,
    feedback: 0.35,
    fileName: '',
    size: 30,
    mass: 1,
    gravityStrength: 1,
    attraction: 0.42,
    repulsion: 0.95,
    orbit: 0.32,
    influenceRadius: 260,
    ...overrides,
  };
}

function createDefaultNodes() {
  return Array.from({ length: MAX_AUDIO_NODES }, () => createNode('muted'));
}

function selectedNode(params) {
  const index = Number(params.selectedNode) || 0;
  if (!params.nodes[index]) params.nodes[index] = createNode('muted');
  return params.nodes[index];
}

function optionsHtml(options, value) {
  return Object.entries(options)
    .map(([label, optionValue]) => `<option value="${optionValue}" ${optionValue === value ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function row(label, control, value = '') {
  return `<label class="node-row"><span>${label}</span>${control}<output>${value}</output></label>`;
}

function section(title, kicker, help, body) {
  return `<section class="node-section">
    <div class="section-head"><h3>${title}</h3>${kicker ? `<span class="section-kicker">${kicker}</span>` : ''}</div>
    ${help ? `<p class="section-help">${help}</p>` : ''}
    ${body}
  </section>`;
}

function group(title, body) {
  return `<div class="control-group"><div class="control-group-title">${title}</div>${body}</div>`;
}

function select(scope, prop, value, options) {
  return `<select data-scope="${scope}" data-prop="${prop}">${optionsHtml(options, value)}</select>`;
}

function range(scope, prop, value, min, max, step) {
  return `<input type="range" data-scope="${scope}" data-prop="${prop}" value="${value}" min="${min}" max="${max}" step="${step}">`;
}

function number(scope, prop, value, min, max, step) {
  return `<input type="number" data-scope="${scope}" data-prop="${prop}" value="${value}" min="${min}" max="${max}" step="${step}">`;
}

function checkbox(scope, prop, value) {
  return `<input type="checkbox" data-scope="${scope}" data-prop="${prop}" ${value ? 'checked' : ''}>`;
}

function text(scope, prop, value) {
  return `<input type="text" data-scope="${scope}" data-prop="${prop}" value="${value ?? ''}">`;
}

function renderSource(node) {
  const controls = [
    row('Instrument', select('node', 'instrument', node.instrument ?? 'synth', INSTRUMENT_OPTIONS)),
    row('Rhythm', select('node', 'rhythm', node.rhythm ?? '1/8', RHYTHM_OPTIONS)),
    row('Chance', range('node', 'probability', node.probability ?? 0.65, 0, 1, 0.01), Number(node.probability ?? 0.65).toFixed(2)),
    row('Time Offset', select('node', 'timingOffsetSource', node.timingOffsetSource ?? 'none', TIMING_OFFSET_OPTIONS)),
    row('Offset Amt', range('node', 'timingOffsetAmount', node.timingOffsetAmount ?? 0, 0, 0.85, 0.01), Number(node.timingOffsetAmount ?? 0).toFixed(2)),
    row('Sound Type', select('node', 'sourceType', node.sourceType, SOURCE_OPTIONS)),
    row('Motion Mode', select('node', 'behavior', node.behavior, BEHAVIOR_OPTIONS)),
    row('Reads', select('node', 'motionParam', node.motionParam, MOVEMENT_OPTIONS)),
    row('Level', range('node', 'gain', node.gain, 0, 1, 0.01), Number(node.gain).toFixed(2)),
    row('Amp Floor', range('node', 'ampFloor', node.ampFloor ?? (node.sourceType === 'noise' ? 0.24 : 0.72), 0, 1, 0.01), Number(node.ampFloor ?? (node.sourceType === 'noise' ? 0.24 : 0.72)).toFixed(2)),
    row('Tone Cutoff', range('node', 'filterCutoff', node.filterCutoff, 120, 16000, 10), Math.round(node.filterCutoff)),
    row('Auto Pan', checkbox('node', 'spacePan', node.spacePan)),
  ];

  if (node.sourceType === 'scale') {
    controls.push(
      row('Scale', select('node', 'scale', node.scale, SCALE_OPTIONS)),
      row('Octave', number('node', 'baseOctave', node.baseOctave, 1, 5, 1)),
      row('Wave', select('node', 'waveform', node.waveform, { Sine: 'sine', Triangle: 'triangle', Saw: 'sawtooth', Square: 'square' }))
    );
  }

  if (node.sourceType === 'note') {
    controls.push(
      row('MIDI', number('node', 'midiNote', node.midiNote, 24, 96, 1)),
      row('Pitch Move', range('node', 'pitchDepth', node.pitchDepth, 0, 24, 1), node.pitchDepth),
      row('Wave', select('node', 'waveform', node.waveform, { Sine: 'sine', Triangle: 'triangle', Saw: 'sawtooth', Square: 'square' }))
    );
  }

  return controls.join('');
}

function renderEnvelope(node) {
  return [
    row('Target', select('node', 'target', node.target, TARGET_OPTIONS)),
    row('Reads', select('node', 'movement', node.movement, MOVEMENT_OPTIONS)),
    row('Changes', select('node', 'destination', node.destination, { Amplitude: 'amp', Pitch: 'pitch', Filter: 'filter', Pan: 'pan' })),
    row('Direction', select('node', 'polarity', node.polarity, { Positive: 'positive', Inverse: 'inverse' })),
    row('Depth', range('node', 'amount', node.amount, 0, 1.5, 0.01), Number(node.amount).toFixed(2)),
    row('Attack', range('node', 'attack', node.attack, 0.005, 1.5, 0.005), Number(node.attack).toFixed(2)),
    row('Release', range('node', 'release', node.release, 0.005, 2.5, 0.005), Number(node.release).toFixed(2)),
    row('Trigger', select('node', 'trigger', node.trigger ?? 'none', TRIGGER_OPTIONS)),
    row('Trig Level', range('node', 'triggerThreshold', node.triggerThreshold ?? 0.68, 0.05, 1, 0.01), Number(node.triggerThreshold ?? 0.68).toFixed(2)),
    row('Trig Hit', range('node', 'triggerAmount', node.triggerAmount ?? 0.6, 0, 1.5, 0.01), Number(node.triggerAmount ?? 0.6).toFixed(2)),
    row('Trig Decay', range('node', 'triggerDecay', node.triggerDecay ?? 0.16, 0.025, 1.5, 0.005), Number(node.triggerDecay ?? 0.16).toFixed(2)),
  ].join('');
}

function renderEffect(node) {
  const controls = [
    row('Effect', select('node', 'effectType', node.effectType, { Reverb: 'reverb', Echo: 'echo', Flanger: 'flanger', 'Low-pass': 'lowpass', 'High-pass': 'highpass', Compressor: 'compressor', Saturation: 'saturation' })),
    row('Target', select('node', 'target', node.target, TARGET_OPTIONS)),
    row('Reads', select('node', 'movement', node.movement, MOVEMENT_OPTIONS)),
    row('Base Wet', range('node', 'baseMix', node.baseMix, 0, 1, 0.01), Number(node.baseMix).toFixed(2)),
    row('Motion Wet', range('node', 'amount', node.amount, 0, 1, 0.01), Number(node.amount).toFixed(2)),
  ];

  if (node.effectType === 'echo') {
    controls.push(
      row('Delay', range('node', 'time', node.time, 0.03, 1.5, 0.01), Number(node.time).toFixed(2)),
      row('Feedback', range('node', 'feedback', node.feedback, 0, 0.82, 0.01), Number(node.feedback).toFixed(2))
    );
  }

  return controls.join('');
}

function refreshFileControl(params) {
  const rowEl = document.getElementById('synth-file-row');
  const label = document.getElementById('synth-file-name');
  const node = selectedNode(params);
  const visible = node.role === 'source' && node.sourceType === 'file';
  rowEl?.classList.toggle('visible', visible);
  if (label) label.textContent = node.fileName || 'No file loaded';
}

function physicsConfig(node) {
  return {
    size: node.size,
    mass: node.mass,
    gravityStrength: node.gravityStrength,
    attraction: node.attraction,
    repulsion: node.repulsion,
    orbit: node.orbit,
    influenceRadius: node.influenceRadius,
  };
}

function syncVisualNode(params, index = Number(params.selectedNode) || 0) {
  const node = params.nodes[index];
  if (node?.role && node.role !== 'muted') {
    window.GlidePathEnsureNode?.(index, node.name || `Node ${index + 1}`, node.role, physicsConfig(node));
    return;
  }
  window.GlidePathRemoveNode?.(index);
  window.GlidePathSyncNode?.(index, node?.name || `Node ${index + 1}`, node?.role || 'muted', physicsConfig(node ?? {}));
}

function addNode(params) {
  const index = params.nodes.findIndex((node) => node.role === 'muted');
  if (index < 0) return false;
  params.nodes[index] = createNode('source', {
    name: `Node ${index + 1}`,
    sourceType: 'scale',
    behavior: 'spatial',
    motionParam: 'angle',
    gain: 0.42,
  });
  params.selectedNode = index;
  window.GlidePathAddNode?.(index, params.nodes[index].name, params.nodes[index].role, physicsConfig(params.nodes[index]));
  return true;
}

function clearNodes(params) {
  params.nodes = createDefaultNodes();
  params.selectedNode = 0;
  window.GlidePathClearNodes?.();
}

function randomizeNodePhysics(nodes, preset) {
  return nodes.map((node) => {
    if (!node || node.role === 'muted') return node;
    const heavy = preset === 'heavy';
    const scattered = preset === 'scattered';
    const clustered = preset === 'clustered';
    const chaotic = preset === 'chaotic';
    return {
      ...node,
      size: Math.round(22 + Math.random() * 22),
      mass: Number((0.55 + Math.random() * (heavy ? 3.8 : 1.8)).toFixed(2)),
      gravityStrength: Number((0.45 + Math.random() * (chaotic ? 1.9 : 1.1)).toFixed(2)),
      attraction: Number(((scattered ? 0.08 : 0.22) + Math.random() * (clustered ? 1.0 : 0.65)).toFixed(2)),
      repulsion: Number((0.7 + Math.random() * (scattered ? 1.5 : 0.85)).toFixed(2)),
      orbit: Number(((preset === 'calm' ? 0.12 : -0.25) + Math.random() * (chaotic ? 1.4 : 1.0)).toFixed(2)),
      influenceRadius: Math.round(180 + Math.random() * (scattered ? 340 : 180)),
    };
  });
}

const BORDER_MODE_OPTIONS = { Repel: 'repel', Bounce: 'bounce', Wrap: 'wrap', None: 'none' };
const MOVEMENT_PRESET_OPTIONS = {
  Calm: 'calm',
  Orbital: 'orbital',
  Chaotic: 'chaotic',
  Clustered: 'clustered',
  Scattered: 'scattered',
  Heavy: 'heavy',
  Minimal: 'minimal',
  Aggressive: 'aggressive',
  Swarm: 'swarm',
};
const MOVEMENT_PRESET_PARAMS = {
  calm: { gravity: 300, damping: 0.994, borderMargin: 80 },
  orbital: { gravity: 520, damping: 0.992, borderMargin: 80 },
  chaotic: { gravity: 760, damping: 0.986, borderMargin: 90 },
  clustered: { gravity: 440, damping: 0.99, borderMargin: 80 },
  scattered: { gravity: 380, damping: 0.993, borderMargin: 95 },
  heavy: { gravity: 680, damping: 0.988, borderMargin: 90, centerMassEnabled: true, centerMass: 2.2, centerMassRadius: 130, centerMassOrbit: 0.22 },
  minimal: { gravity: 180, damping: 0.997, borderMargin: 120, centerMassEnabled: true, centerMass: 0.35, centerMassRadius: 180, centerMassOrbit: 0.08 },
  aggressive: { gravity: 1180, damping: 0.978, borderMargin: 70, centerMassEnabled: true, centerMass: 1.7, centerMassRadius: 82, centerMassOrbit: 0.95 },
  swarm: { gravity: 900, damping: 0.982, borderMargin: 70, centerMassEnabled: true, centerMass: 0.9, centerMassRadius: 110, centerMassOrbit: -0.75 },
};
const AUDIO_PRESET_OPTIONS = {
  'Melodic Orbit': 'melodicOrbit',
  'Percussion Web': 'percussionWeb',
  'Harmonic Garden': 'harmonicGarden',
  'Bass + Bells': 'bassAndBells',
  'Sparse Motion': 'sparseMotion',
  'Impact Texture': 'impactTexture',
  'Experimental Flux': 'experimentalFlux',
  'Noise Percussion Grid': 'noisePercussionGrid',
  'Slow Filter Bloom': 'slowFilterBloom',
  'Orbit Triggered Hats': 'orbitTriggeredHats',
  'Minimal Static Design': 'minimalStaticDesign',
  'Swarm Delay Field': 'swarmDelayField',
  'Mix Spatial Glue': 'mixSpatialGlue',
  'Heroic Forest Chords': 'heroicForestChords',
  'Crystal Prelude': 'crystalPrelude',
  Blank: 'blank',
};
const AUDIO_PRESET_PARAMS = {
  melodicOrbit: { movementPreset: 'orbital', globalScale: 'aminorpenta', bpm: 96, masterVolume: 0.62, outputGain: 0.78, centerMass: 1.25, centerMassRadius: 104, centerMassOrbit: 0.42 },
  percussionWeb: { movementPreset: 'chaotic', globalScale: 'aminorpenta', bpm: 112, masterVolume: 0.58, outputGain: 0.76, centerMass: 0.9, centerMassRadius: 88, centerMassOrbit: 0.58 },
  harmonicGarden: { movementPreset: 'calm', globalScale: 'adorian', bpm: 72, masterVolume: 0.56, outputGain: 0.8, centerMass: 0.7, centerMassRadius: 136, centerMassOrbit: 0.18 },
  bassAndBells: { movementPreset: 'heavy', globalScale: 'amajor', bpm: 88, masterVolume: 0.6, outputGain: 0.76, centerMass: 1.75, centerMassRadius: 128, centerMassOrbit: 0.28 },
  sparseMotion: { movementPreset: 'orbital', globalScale: 'aminor', bpm: 80, masterVolume: 0.58, outputGain: 0.78, centerMass: 1.0, centerMassRadius: 112, centerMassOrbit: 0.28 },
  impactTexture: { movementPreset: 'chaotic', globalScale: 'dminor', bpm: 118, masterVolume: 0.56, outputGain: 0.72, centerMass: 1.1, centerMassRadius: 96, centerMassOrbit: 0.54 },
  experimentalFlux: { movementPreset: 'scattered', globalScale: 'dminor', bpm: 104, masterVolume: 0.54, outputGain: 0.72, centerMass: 0.55, centerMassRadius: 150, centerMassOrbit: -0.35 },
  noisePercussionGrid: { movementPreset: 'aggressive', globalScale: 'aminorpenta', bpm: 124, masterVolume: 0.52, outputGain: 0.72, centerMass: 1.4, centerMassRadius: 78, centerMassOrbit: 0.9 },
  slowFilterBloom: { movementPreset: 'minimal', globalScale: 'adorian', bpm: 64, masterVolume: 0.58, outputGain: 0.82, centerMass: 0.4, centerMassRadius: 190, centerMassOrbit: 0.08 },
  orbitTriggeredHats: { movementPreset: 'orbital', globalScale: 'aminorpenta', bpm: 110, masterVolume: 0.54, outputGain: 0.74, centerMass: 1.15, centerMassRadius: 96, centerMassOrbit: 0.68 },
  minimalStaticDesign: { movementPreset: 'minimal', globalScale: 'aminor', bpm: 72, masterVolume: 0.5, outputGain: 0.82, centerMass: 0.2, centerMassRadius: 210, centerMassOrbit: 0.04 },
  swarmDelayField: { movementPreset: 'swarm', globalScale: 'dminor', bpm: 132, masterVolume: 0.5, outputGain: 0.68, centerMass: 0.95, centerMassRadius: 112, centerMassOrbit: -0.72 },
  mixSpatialGlue: { movementPreset: 'calm', globalScale: 'amajor', bpm: 84, masterVolume: 0.56, outputGain: 0.82, centerMass: 0.65, centerMassRadius: 155, centerMassOrbit: 0.2 },
  heroicForestChords: { movementPreset: 'minimal', globalScale: 'alydian', bpm: 68, masterVolume: 0.5, outputGain: 0.84, centerMass: 0.42, centerMassRadius: 190, centerMassOrbit: 0.12 },
  crystalPrelude: { movementPreset: 'calm', globalScale: 'amajorpenta', bpm: 76, masterVolume: 0.52, outputGain: 0.82, centerMass: 0.58, centerMassRadius: 165, centerMassOrbit: -0.18 },
};

function mutedNodes(count) {
  return Array.from({ length: count }, () => createNode('muted'));
}

function renderPanel(host, params, presets) {
  const node = selectedNode(params);
  const selectedIndex = Number(params.selectedNode) || 0;

  // Only show active nodes in selector
  const nodeOptions = {};
  for (let i = 0; i < MAX_AUDIO_NODES; i++) {
    const n = params.nodes[i];
    if (n && n.role !== 'muted') {
      nodeOptions[n.name || `Node ${i + 1}`] = String(i);
    }
  }
  // Always include current selection
  if (!nodeOptions[node.name || `Node ${selectedIndex + 1}`]) {
    nodeOptions[node.name || `Node ${selectedIndex + 1}`] = String(selectedIndex);
  }

  let nodeControls = '';
  if (node.role === 'source') nodeControls = renderSource(node);
  if (node.role === 'envelope') nodeControls = renderEnvelope(node);
  if (node.role === 'effect') nodeControls = renderEffect(node);

  host.innerHTML = `
    ${section('Sound Design', 'Preset', 'Choose a musical starting point, then tune levels and scale.', `
      ${group('Musical Setup', `
        ${row('Preset', select('params', 'preset', params.preset, AUDIO_PRESET_OPTIONS))}
        ${row('Scale', select('params', 'globalScale', params.globalScale, SCALE_OPTIONS))}
      `)}
      ${group('Timing + Mix', `
        ${row('BPM', range('params', 'bpm', params.bpm ?? 96, 45, 180, 1), Math.round(params.bpm ?? 96))}
        ${row('Input Trim', range('params', 'masterVolume', params.masterVolume, 0, 1, 0.01), Number(params.masterVolume).toFixed(2))}
        ${row('Output', range('params', 'outputGain', params.outputGain, 0, 1.2, 0.01), Number(params.outputGain).toFixed(2))}
      `)}
    `)}

    ${section('Movement', 'Physics', 'Controls how nodes travel, orbit, separate, and react to the center mass.', `
      ${group('World Motion', `
        ${row('Motion Preset', select('physics', 'movementPreset', params.movementPreset ?? 'orbital', MOVEMENT_PRESET_OPTIONS))}
        ${row('Gravity', range('physics', 'gravity', params.gravity ?? 500, 10, 2000, 10), Math.round(params.gravity ?? 500))}
        ${row('Damping', range('physics', 'damping', params.damping ?? 0.992, 0.94, 1.0, 0.001), Number(params.damping ?? 0.992).toFixed(3))}
      `)}
      ${group('Boundaries', `
        ${row('Edge Mode', select('physics', 'borderMode', params.borderMode ?? 'repel', BORDER_MODE_OPTIONS))}
        ${row('Edge Margin', range('physics', 'borderMargin', params.borderMargin ?? 80, 10, 220, 5), Math.round(params.borderMargin ?? 80))}
      `)}
      ${group('Center Mass', `
        ${row('Enabled', checkbox('physics', 'centerMassEnabled', params.centerMassEnabled ?? true))}
        ${row('Strength', range('physics', 'centerMass', params.centerMass ?? 1.2, 0, 5, 0.05), Number(params.centerMass ?? 1.2).toFixed(2))}
        ${row('Safe Radius', range('physics', 'centerMassRadius', params.centerMassRadius ?? 96, 48, 260, 4), Math.round(params.centerMassRadius ?? 96))}
        ${row('Orbit Push', range('physics', 'centerMassOrbit', params.centerMassOrbit ?? 0.34, -1.5, 1.5, 0.01), Number(params.centerMassOrbit ?? 0.34).toFixed(2))}
      `)}
    `)}

    ${section(`Node ${selectedIndex + 1}${node.name ? ` — ${node.name}` : ''}`, node.role || 'Muted', 'Select a node, decide what it does, then shape how it moves and modulates sound.', `
      ${group('Identity', `
        ${Object.keys(nodeOptions).length > 1 ? row('Selected', select('params', 'selectedNode', String(selectedIndex), nodeOptions)) : ''}
        ${row('Name', text('node', 'name', node.name || ''))}
        ${row('Role', select('node', 'role', node.role, ROLE_OPTIONS))}
        ${row('Enabled', checkbox('node', 'enabled', node.enabled))}
      `)}
      ${nodeControls ? group(node.role === 'source' ? 'Sound' : node.role === 'envelope' ? 'Modulation' : 'Effect', nodeControls) : ''}
      ${group('Physical Behavior', `
        ${row('Size', range('node', 'size', node.size ?? 30, 14, 64, 1), Math.round(node.size ?? 30))}
        ${row('Mass', range('node', 'mass', node.mass ?? 1, 0.25, 6, 0.05), Number(node.mass ?? 1).toFixed(2))}
        ${row('Gravity', range('node', 'gravityStrength', node.gravityStrength ?? 1, 0.1, 3, 0.05), Number(node.gravityStrength ?? 1).toFixed(2))}
        ${row('Attract', range('node', 'attraction', node.attraction ?? 0.42, 0, 2, 0.01), Number(node.attraction ?? 0.42).toFixed(2))}
        ${row('Repel', range('node', 'repulsion', node.repulsion ?? 0.95, 0, 2.5, 0.01), Number(node.repulsion ?? 0.95).toFixed(2))}
        ${row('Orbit', range('node', 'orbit', node.orbit ?? 0.32, -1.5, 1.5, 0.01), Number(node.orbit ?? 0.32).toFixed(2))}
        ${row('Influence', range('node', 'influenceRadius', node.influenceRadius ?? 260, 80, 640, 5), Math.round(node.influenceRadius ?? 260))}
      `)}
    `)}
  `;

  refreshFileControl(params);
}

function updateFromControl(element, params, presets, render) {
  const scope = element.dataset.scope;
  const prop = element.dataset.prop;
  if (!scope || !prop) return;

  let value = element.type === 'checkbox' ? element.checked : element.value;
  if (element.type === 'range' || element.type === 'number') value = Number(value);
  if (prop === 'selectedNode') value = Number(value);

  // Physics controls dispatch directly to the engine
  if (scope === 'physics') {
    if (prop === 'gravity') { params.gravity = value; window.GlidePathSetGravity?.(value); }
    else if (prop === 'damping') { params.damping = value; window.GlidePathSetDamping?.(value); }
    else if (prop === 'borderMode') { params.borderMode = value; window.GlidePathSetBorderMode?.(value); }
    else if (prop === 'borderMargin') { params.borderMargin = value; window.GlidePathSetBorderMargin?.(value); }
    else if (prop === 'centerMassEnabled') { params.centerMassEnabled = value; window.GlidePathSetCenterMassEnabled?.(value); }
    else if (prop === 'centerMass') { params.centerMass = value; window.GlidePathSetCenterMass?.(value); }
    else if (prop === 'centerMassRadius') { params.centerMassRadius = value; window.GlidePathSetCenterMassRadius?.(value); }
    else if (prop === 'centerMassOrbit') { params.centerMassOrbit = value; window.GlidePathSetCenterMassOrbit?.(value); }
    else if (prop === 'movementPreset') {
      params.movementPreset = value;
      Object.assign(params, MOVEMENT_PRESET_PARAMS[value] ?? {});
      window.GlidePathApplyMovementPreset?.(value);
    }
    const output = element.parentElement?.querySelector('output');
    if (output && (element.type === 'range' || element.type === 'number')) output.textContent = Number(value).toFixed(value < 10 ? 3 : 0);
    if (prop === 'movementPreset') render();
    return;
  }

  const target = scope === 'node' ? selectedNode(params) : params;
  target[prop] = value;

  if (scope === 'params' && prop === 'selectedNode') {
    window.GlidePathSelectNode?.(value);
  }

  if (scope === 'params' && prop === 'preset') {
    const audioDefaults = AUDIO_PRESET_PARAMS[value] ?? {};
    Object.assign(params, audioDefaults);
    Object.assign(params, MOVEMENT_PRESET_PARAMS[params.movementPreset] ?? {}, audioDefaults);
    params.nodes = presets[value]();
    params.selectedNode = 0;
    window.GlidePathClearNodes?.();
    window.GlidePathSetCenterMassEnabled?.(params.centerMassEnabled);
    window.GlidePathSetCenterMass?.(params.centerMass);
    window.GlidePathSetCenterMassRadius?.(params.centerMassRadius);
    window.GlidePathSetCenterMassOrbit?.(params.centerMassOrbit);
    params.nodes.forEach((node, index) => {
      if (node.role !== 'muted') window.GlidePathAddNode?.(index, node.name || `Node ${index + 1}`, node.role, physicsConfig(node));
    });
    window.GlidePathApplyMovementPreset?.(params.movementPreset ?? 'orbital');
  }

  const needsRender = ['preset', 'selectedNode', 'role', 'sourceType', 'effectType'].includes(prop);
  if (needsRender) render();
  else {
    const output = element.parentElement?.querySelector('output');
    if (output && (element.type === 'range' || element.type === 'number')) output.textContent = Number(value).toFixed(value < 10 ? 2 : 0);
    refreshFileControl(params);
  }

  if (scope === 'node') syncVisualNode(params);
}

export function createSidebar() {
  injectStyles();

  const sidebar = document.createElement('aside');
  sidebar.id = 'synth-sidebar';
  sidebar.innerHTML = `
    <header class="synth-header">
      <span class="synth-title">GlidePath — Audio Motion</span>
      <button class="synth-position-toggle" id="synth-position-btn" title="Move panel">Move: Right</button>
      <button class="synth-toggle" id="synth-toggle-btn" title="Hide panel">×</button>
    </header>
    <div class="synth-status-bar"><div class="synth-status-bar-fill" id="synth-level-bar"></div></div>
    <div class="synth-pane-host" id="synth-pane-host"></div>
    <footer class="synth-footer">
      <div class="synth-file-row" id="synth-file-row">
        <span id="synth-file-name">No file loaded</span>
        <input type="file" id="synth-sample-input" accept="audio/*">
      </div>
      <div class="footer-label">Nodes</div>
      <div class="synth-footer-row">
        <button class="synth-btn" id="synth-prev-btn">Prev</button>
        <button class="synth-btn" id="synth-next-btn">Next</button>
        <button class="synth-btn" id="synth-add-btn">Add</button>
        <button class="synth-btn" id="synth-random-btn">Random</button>
      </div>
      <div class="footer-label">View</div>
      <div class="synth-footer-row">
        <button class="synth-btn" id="synth-freeze-btn">Freeze</button>
        <button class="synth-btn" id="synth-trails-btn">Trails</button>
        <button class="synth-btn" id="synth-clear-btn">Clear</button>
        <button class="synth-btn" id="synth-resetview-btn">Reset</button>
      </div>
      <div class="footer-label">Audio</div>
      <div class="synth-footer-row">
        <button class="synth-btn" id="synth-start-btn">Play</button>
        <button class="synth-btn" id="synth-record-btn">Record</button>
        <button class="synth-btn" id="synth-copy-btn">Copy</button>
      </div>
    </footer>
  `;
  document.body.appendChild(sidebar);

  const openBtn = document.createElement('button');
  openBtn.id = 'synth-open-btn';
  openBtn.textContent = '▶';
  openBtn.title = 'Open panel';
  document.body.appendChild(openBtn);

  applySidebarPosition(sidebar, openBtn, localStorage.getItem(SIDEBAR_POSITION_STORAGE_KEY));

  const params = {
    preset: 'melodicOrbit',
    selectedNode: 0,
    visualPaused: false,
    bpm: 96,
    masterVolume: 0.62,
    outputGain: 0.78,
    globalScale: 'aminor',
    baseOctave: 4,
    gravity: 520,
    damping: 0.992,
    borderMode: 'repel',
    borderMargin: 80,
    centerMassEnabled: true,
    centerMass: 1.2,
    centerMassRadius: 96,
    centerMassOrbit: 0.34,
    movementPreset: 'orbital',
    nodes: createDefaultNodes(),
  };

  const presets = {
    blank: createDefaultNodes,
    melodicOrbit: () => [
      createNode('source', { name: 'Lead Orbit', instrument: 'arp', rhythm: '1/8', probability: 0.72, sourceType: 'scale', behavior: 'spatial-time', motionParam: 'angle', scale: 'aminorpenta', baseOctave: 4, waveform: 'triangle', gain: 0.28, filterCutoff: 7200, size: 28, mass: 0.9, attraction: 0.32, repulsion: 1.15, orbit: 0.72 }),
      createNode('source', { name: 'Answer Bell', instrument: 'pluck', rhythm: '1/4', probability: 0.55, sourceType: 'scale', behavior: 'spatial', motionParam: 'nearest', scale: 'amajor', baseOctave: 5, waveform: 'sine', gain: 0.2, filterCutoff: 9800, size: 24, mass: 0.7, attraction: 0.22, repulsion: 1.45, orbit: -0.55 }),
      createNode('source', { name: 'Warm Root', instrument: 'bass', rhythm: '1/2', probability: 0.75, sourceType: 'note', behavior: 'spatial-time', motionParam: 'distance', waveform: 'sine', midiNote: 45, pitchDepth: 5, gain: 0.22, filterCutoff: 3200, size: 42, mass: 2.2, gravityStrength: 1.1, attraction: 0.58, repulsion: 0.78, orbit: 0.18, influenceRadius: 360 }),
      createNode('envelope', { name: 'Proximity Swell', movement: 'near', target: 'sources', destination: 'amp', amount: 0.42, attack: 0.12, release: 0.85, size: 24, mass: 0.8, attraction: 0.28, repulsion: 1.3, orbit: 0.38 }),
      createNode('envelope', { name: 'Orbit Brightness', movement: 'orbit', target: 'sources', destination: 'filter', amount: 0.5, attack: 0.08, release: 0.7, size: 24, mass: 0.75, attraction: 0.28, repulsion: 1.25, orbit: -0.4 }),
      createNode('effect', { name: 'Tempo Echo', effectType: 'echo', movement: 'angularVelocity', target: 'mix', baseMix: 0.08, amount: 0.24, time: 0.28, feedback: 0.28, size: 30, mass: 1.0, attraction: 0.34, repulsion: 1.0, orbit: 0.5 }),
      createNode('effect', { name: 'Small Room', effectType: 'reverb', movement: 'distance', target: 'mix', baseMix: 0.12, amount: 0.2, size: 34, mass: 1.1, attraction: 0.35, repulsion: 0.95, orbit: 0.32 }),
      ...mutedNodes(MAX_AUDIO_NODES - 7),
    ],
    percussionWeb: () => [
      createNode('source', { name: 'Dust Hat', instrument: 'hat', rhythm: '1/16', probability: 0.72, sourceType: 'noise', behavior: 'spatial', motionParam: 'speed', gain: 0.26, filterCutoff: 6200, size: 22, mass: 0.55, attraction: 0.12, repulsion: 1.9, orbit: 0.95 }),
      createNode('source', { name: 'Body Thump', instrument: 'kick', rhythm: '1/4', probability: 0.9, sourceType: 'note', behavior: 'spatial', motionParam: 'repulsion', waveform: 'sine', midiNote: 36, pitchDepth: 10, gain: 0.34, filterCutoff: 1200, size: 48, mass: 2.8, gravityStrength: 1.6, attraction: 0.75, repulsion: 0.82, orbit: -0.18, influenceRadius: 380 }),
      createNode('source', { name: 'Wood Click', instrument: 'snare', rhythm: '1/2', probability: 0.62, sourceType: 'note', behavior: 'spatial', motionParam: 'acceleration', waveform: 'triangle', midiNote: 72, pitchDepth: 7, gain: 0.18, filterCutoff: 7600, size: 24, mass: 0.65, attraction: 0.18, repulsion: 1.7, orbit: -0.8 }),
      createNode('envelope', { name: 'Impact Gate', movement: 'acceleration', target: 'sources', destination: 'amp', amount: 0.82, attack: 0.008, release: 0.18, polarity: 'positive', size: 24, mass: 0.7, attraction: 0.14, repulsion: 1.8, orbit: 0.9 }),
      createNode('envelope', { name: 'Distance Mute', movement: 'nearest', target: 'sources', destination: 'filter', amount: 0.42, attack: 0.02, release: 0.28, size: 24, mass: 0.8, attraction: 0.18, repulsion: 1.6, orbit: 0.55 }),
      createNode('effect', { name: 'Slap Echo', effectType: 'echo', movement: 'interaction', target: 'mix', baseMix: 0.05, amount: 0.28, time: 0.14, feedback: 0.2, size: 28, mass: 0.9, attraction: 0.25, repulsion: 1.2, orbit: 0.45 }),
      createNode('effect', { name: 'Transient Glue', effectType: 'compressor', movement: 'energy', target: 'mix', baseMix: 0.18, amount: 0.42, size: 36, mass: 1.5, attraction: 0.45, repulsion: 0.9, orbit: 0.15 }),
      ...mutedNodes(MAX_AUDIO_NODES - 7),
    ],
    harmonicGarden: () => [
      createNode('source', { name: 'Pad Root', instrument: 'synth', sourceType: 'note', behavior: 'spatial-time', motionParam: 'distance', waveform: 'sine', midiNote: 45, pitchDepth: 2, gain: 0.2, filterCutoff: 3600, size: 46, mass: 2.4, attraction: 0.62, repulsion: 0.7, orbit: 0.12, influenceRadius: 410 }),
      createNode('source', { name: 'Pad Fifth', instrument: 'synth', sourceType: 'note', behavior: 'spatial-time', motionParam: 'orbit', waveform: 'triangle', midiNote: 52, pitchDepth: 3, gain: 0.18, filterCutoff: 4200, size: 38, mass: 1.6, attraction: 0.44, repulsion: 0.92, orbit: 0.3 }),
      createNode('source', { name: 'High Harmonic', instrument: 'pluck', rhythm: '1/4', probability: 0.38, sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', scale: 'adorian', baseOctave: 5, waveform: 'sine', gain: 0.15, filterCutoff: 11000, size: 24, mass: 0.75, attraction: 0.24, repulsion: 1.35, orbit: -0.45 }),
      createNode('source', { name: 'Soft Air', sourceType: 'noise', behavior: 'spatial-time', motionParam: 'speed', gain: 0.08, filterCutoff: 5200, size: 22, mass: 0.55, attraction: 0.12, repulsion: 1.6, orbit: 0.62 }),
      createNode('envelope', { name: 'Breathing Amp', movement: 'distance', target: 'sources', destination: 'amp', amount: 0.3, attack: 0.55, release: 1.6, size: 26, mass: 0.8, attraction: 0.3, repulsion: 1.2, orbit: 0.25 }),
      createNode('effect', { name: 'Bloom Verb', effectType: 'reverb', movement: 'near', target: 'mix', baseMix: 0.22, amount: 0.3, size: 34, mass: 1.1, attraction: 0.32, repulsion: 1.0, orbit: 0.28 }),
      createNode('effect', { name: 'Slow Flange', effectType: 'flanger', movement: 'orbit', target: 'sources', baseMix: 0.04, amount: 0.18, size: 30, mass: 1.0, attraction: 0.28, repulsion: 1.1, orbit: -0.22 }),
      ...mutedNodes(MAX_AUDIO_NODES - 7),
    ],
    bassAndBells: () => [
      createNode('source', { name: 'Sub Anchor', instrument: 'bass', rhythm: '1/2', probability: 0.82, sourceType: 'note', behavior: 'spatial-time', motionParam: 'distance', waveform: 'sine', midiNote: 33, pitchDepth: 4, gain: 0.3, filterCutoff: 900, size: 52, mass: 3.4, gravityStrength: 1.8, attraction: 0.82, repulsion: 0.7, orbit: 0.08, influenceRadius: 430 }),
      createNode('source', { name: 'Bell A', instrument: 'pluck', rhythm: '1/8', probability: 0.5, sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', scale: 'aminorpenta', baseOctave: 5, waveform: 'sine', gain: 0.16, filterCutoff: 12000, size: 22, mass: 0.55, attraction: 0.18, repulsion: 1.65, orbit: 0.72 }),
      createNode('source', { name: 'Bell B', instrument: 'arp', rhythm: '1/8', probability: 0.45, sourceType: 'scale', behavior: 'spatial-time', motionParam: 'nearest', scale: 'amajor', baseOctave: 5, waveform: 'triangle', gain: 0.14, filterCutoff: 9800, size: 24, mass: 0.65, attraction: 0.2, repulsion: 1.55, orbit: -0.68 }),
      createNode('envelope', { name: 'Bell Duck', movement: 'near', target: 'node-0', destination: 'filter', amount: 0.35, attack: 0.04, release: 0.5, polarity: 'inverse', size: 24, mass: 0.7, attraction: 0.2, repulsion: 1.4, orbit: 0.44 }),
      createNode('envelope', { name: 'Spark Amp', movement: 'repulsion', target: 'sources', destination: 'amp', amount: 0.34, attack: 0.02, release: 0.45, size: 24, mass: 0.65, attraction: 0.18, repulsion: 1.6, orbit: -0.52 }),
      createNode('effect', { name: 'Ping Echo', effectType: 'echo', movement: 'orbit', target: 'mix', baseMix: 0.1, amount: 0.24, time: 0.36, feedback: 0.32, size: 30, mass: 1.0, attraction: 0.3, repulsion: 1.1, orbit: 0.36 }),
      ...mutedNodes(MAX_AUDIO_NODES - 6),
    ],
    sparseMotion: () => [
      createNode('source', { name: 'Orbit Tone', instrument: 'pluck', rhythm: '1/4', probability: 0.48, sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', waveform: 'triangle', gain: 0.26, filterCutoff: 6500, size: 28, mass: 0.9, attraction: 0.36, repulsion: 1.05, orbit: 0.58 }),
      createNode('source', { name: 'Low Drone', instrument: 'synth', sourceType: 'note', behavior: 'spatial-time', motionParam: 'nearest', waveform: 'sine', midiNote: 33, gain: 0.22, filterCutoff: 2600, size: 42, mass: 2.1, gravityStrength: 1.15, attraction: 0.55, repulsion: 0.72, orbit: 0.18, influenceRadius: 340 }),
      createNode('envelope', { name: 'Near Filter', movement: 'near', target: 'sources', destination: 'filter', amount: 0.55, attack: 0.05, release: 0.7, size: 24, mass: 0.75, attraction: 0.28, repulsion: 1.3, orbit: -0.25 }),
      createNode('effect', { name: 'Space Verb', effectType: 'reverb', movement: 'orbit', target: 'mix', baseMix: 0.16, amount: 0.28, size: 34, mass: 1.2, attraction: 0.4, repulsion: 1.0, orbit: 0.5 }),
      ...mutedNodes(MAX_AUDIO_NODES - 4),
    ],
    impactTexture: () => [
      createNode('source', { name: 'Motion Noise', instrument: 'hat', rhythm: '1/16', probability: 0.78, sourceType: 'noise', behavior: 'spatial', motionParam: 'speed', filterCutoff: 1900, gain: 0.32, size: 26, mass: 0.8, attraction: 0.22, repulsion: 1.5, orbit: 0.75 }),
      createNode('source', { name: 'Impact Root', instrument: 'kick', rhythm: '1/4', probability: 0.78, sourceType: 'note', behavior: 'spatial', motionParam: 'repulsion', waveform: 'sawtooth', midiNote: 36, pitchDepth: 19, gain: 0.25, filterCutoff: 1400, size: 46, mass: 2.5, gravityStrength: 1.6, attraction: 0.8, repulsion: 0.85, orbit: -0.15, influenceRadius: 380 }),
      createNode('envelope', { name: 'Acceleration Hit', movement: 'acceleration', target: 'sources', destination: 'amp', amount: 0.75, attack: 0.01, release: 0.16, size: 24, mass: 0.7, attraction: 0.18, repulsion: 1.8, orbit: 0.9 }),
      createNode('effect', { name: 'Spin Flange', effectType: 'flanger', movement: 'angularVelocity', target: 'sources', baseMix: 0.08, amount: 0.34, size: 32, mass: 1.1, attraction: 0.35, repulsion: 1.1, orbit: 1.0 }),
      createNode('effect', { name: 'Energy Glue', effectType: 'compressor', movement: 'energy', target: 'mix', baseMix: 0.18, amount: 0.45, size: 38, mass: 1.7, attraction: 0.5, repulsion: 0.95, orbit: 0.2 }),
      ...mutedNodes(MAX_AUDIO_NODES - 5),
    ],
    experimentalFlux: () => [
      createNode('source', { name: 'Flux Noise', instrument: 'hat', rhythm: '1/16', probability: 0.62, sourceType: 'noise', behavior: 'random', motionParam: 'speed', gain: 0.22, ampFloor: 0.05, filterCutoff: 3400, size: 26, mass: 0.75, attraction: 0.05, repulsion: 2.05, orbit: 1.1, influenceRadius: 420 }),
      createNode('source', { name: 'Bent Carrier', instrument: 'bass', rhythm: '1/4', probability: 0.5, sourceType: 'note', behavior: 'spatial-time', motionParam: 'angularVelocity', waveform: 'sawtooth', midiNote: 48, pitchDepth: 21, gain: 0.18, filterCutoff: 4200, size: 34, mass: 1.4, attraction: 0.34, repulsion: 1.3, orbit: -1.0 }),
      createNode('source', { name: 'Glass Thread', instrument: 'arp', rhythm: '1/8', probability: 0.54, sourceType: 'scale', behavior: 'spatial', motionParam: 'repulsion', scale: 'dminor', baseOctave: 5, waveform: 'sine', gain: 0.13, filterCutoff: 13000, size: 22, mass: 0.5, attraction: 0.15, repulsion: 1.9, orbit: 0.84 }),
      createNode('envelope', { name: 'Chaos Pan', movement: 'x', target: 'sources', destination: 'pan', amount: 0.72, attack: 0.03, release: 0.35, size: 24, mass: 0.7, attraction: 0.16, repulsion: 1.7, orbit: -0.6 }),
      createNode('envelope', { name: 'Acceleration Pitch', movement: 'acceleration', target: 'sources', destination: 'pitch', amount: 0.5, attack: 0.02, release: 0.28, trigger: 'impact', triggerThreshold: 0.58, triggerAmount: 0.35, triggerDecay: 0.11, size: 24, mass: 0.75, attraction: 0.2, repulsion: 1.5, orbit: 0.7 }),
      createNode('effect', { name: 'Moving Filter', effectType: 'lowpass', movement: 'nearest', target: 'mix', baseMix: 0.0, amount: 0.75, size: 28, mass: 0.9, attraction: 0.24, repulsion: 1.3, orbit: 0.42 }),
      createNode('effect', { name: 'Wide Flange', effectType: 'flanger', movement: 'orbit', target: 'mix', baseMix: 0.1, amount: 0.34, size: 30, mass: 1.0, attraction: 0.3, repulsion: 1.2, orbit: -0.4 }),
      ...mutedNodes(MAX_AUDIO_NODES - 7),
    ],
    noisePercussionGrid: () => [
      createNode('source', { name: 'Closed Noise Hat', sourceType: 'noise', behavior: 'spatial', motionParam: 'speed', gain: 0.38, ampFloor: 0.01, filterCutoff: 11800, size: 22, mass: 0.55, attraction: 0.1, repulsion: 2.1, orbit: 1.15, influenceRadius: 360 }),
      createNode('source', { name: 'Low Body', instrument: 'kick', rhythm: '1/4', probability: 0.94, sourceType: 'note', behavior: 'spatial', motionParam: 'near', midiNote: 36, gain: 0.34, size: 48, mass: 2.6, gravityStrength: 1.8, attraction: 0.85, repulsion: 0.78, orbit: -0.18, influenceRadius: 420 }),
      createNode('source', { name: 'Sharp Tick', instrument: 'hat', rhythm: '1/16', probability: 0.72, sourceType: 'noise', behavior: 'spatial', motionParam: 'orbit', gain: 0.24, size: 22, mass: 0.6, attraction: 0.12, repulsion: 1.9, orbit: -1.05 }),
      createNode('envelope', { name: 'Proximity Perc Gate', movement: 'near', target: 'node-0', destination: 'amp', amount: 0.0, trigger: 'proximity', triggerOnly: true, triggerThreshold: 0.62, triggerAmount: 1.25, triggerDecay: 0.055, attack: 0.005, release: 0.08, size: 24, mass: 0.7, attraction: 0.12, repulsion: 1.9, orbit: 0.95 }),
      createNode('envelope', { name: 'Impact LP Snap', movement: 'acceleration', target: 'node-0', destination: 'filter', amount: 0.25, trigger: 'impact', triggerThreshold: 0.56, triggerAmount: 1.0, triggerDecay: 0.09, attack: 0.005, release: 0.1, size: 24, mass: 0.65, attraction: 0.16, repulsion: 1.7, orbit: -0.7 }),
      createNode('effect', { name: 'Dirty Bus', effectType: 'saturation', movement: 'energy', target: 'mix', baseMix: 0.12, amount: 0.32, size: 32, mass: 1.1, attraction: 0.3, repulsion: 1.15, orbit: 0.34 }),
      createNode('effect', { name: 'Short Room', effectType: 'reverb', movement: 'interaction', target: 'mix', baseMix: 0.04, amount: 0.18, size: 30, mass: 0.9, attraction: 0.25, repulsion: 1.25, orbit: 0.5 }),
      ...mutedNodes(MAX_AUDIO_NODES - 7),
    ],
    slowFilterBloom: () => [
      createNode('source', { name: 'Low Bloom', sourceType: 'note', behavior: 'spatial-time', motionParam: 'distance', waveform: 'sine', midiNote: 40, pitchDepth: 2, gain: 0.24, ampFloor: 0.82, filterCutoff: 1800, size: 50, mass: 2.8, attraction: 0.6, repulsion: 0.65, orbit: 0.08, influenceRadius: 420 }),
      createNode('source', { name: 'Air Noise', sourceType: 'noise', behavior: 'spatial-time', motionParam: 'y', gain: 0.1, ampFloor: 0.35, filterCutoff: 6200, size: 24, mass: 0.65, attraction: 0.18, repulsion: 1.25, orbit: 0.22 }),
      createNode('envelope', { name: 'Slow LP Opening', movement: 'distance', target: 'sources', destination: 'filter', amount: 0.82, attack: 0.9, release: 2.4, size: 28, mass: 0.8, attraction: 0.3, repulsion: 1.0, orbit: 0.18 }),
      createNode('envelope', { name: 'Mass Swell', movement: 'interaction', target: 'sources', destination: 'amp', amount: 0.28, attack: 0.7, release: 2.2, size: 32, mass: 1.4, attraction: 0.42, repulsion: 0.9, orbit: 0.12 }),
      createNode('effect', { name: 'Bloom Hall', effectType: 'reverb', movement: 'near', target: 'mix', baseMix: 0.26, amount: 0.28, size: 38, mass: 1.2, attraction: 0.32, repulsion: 0.9, orbit: 0.16 }),
      createNode('effect', { name: 'Gentle Low-pass', effectType: 'lowpass', movement: 'y', target: 'mix', baseMix: 0, amount: 0.55, size: 28, mass: 0.8, attraction: 0.26, repulsion: 1.1, orbit: -0.12 }),
      ...mutedNodes(MAX_AUDIO_NODES - 6),
    ],
    orbitTriggeredHats: () => [
      createNode('source', { name: 'Orbit Noise Gate', sourceType: 'noise', behavior: 'spatial', motionParam: 'orbit', gain: 0.34, ampFloor: 0.005, filterCutoff: 13200, size: 22, mass: 0.52, attraction: 0.18, repulsion: 1.7, orbit: 1.05, influenceRadius: 340 }),
      createNode('source', { name: 'Pulse Bass', instrument: 'bass', rhythm: '1/2', probability: 0.78, sourceType: 'note', behavior: 'spatial-time', motionParam: 'distance', midiNote: 38, gain: 0.24, size: 46, mass: 2.4, attraction: 0.7, repulsion: 0.72, orbit: 0.22, influenceRadius: 390 }),
      createNode('source', { name: 'Answer Pluck', instrument: 'pluck', rhythm: '1/8', probability: 0.46, sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', baseOctave: 5, gain: 0.16, size: 24, mass: 0.62, attraction: 0.22, repulsion: 1.45, orbit: -0.7 }),
      createNode('envelope', { name: 'Orbit Hat Trigger', movement: 'orbit', target: 'node-0', destination: 'amp', amount: 0.0, trigger: 'orbit', triggerOnly: true, triggerThreshold: 0.34, triggerAmount: 1.35, triggerDecay: 0.045, attack: 0.005, release: 0.06, size: 24, mass: 0.7, attraction: 0.18, repulsion: 1.6, orbit: -0.95 }),
      createNode('effect', { name: 'Dotted Echo', effectType: 'echo', movement: 'angularVelocity', target: 'mix', baseMix: 0.08, amount: 0.22, time: 0.34, feedback: 0.3, size: 30, mass: 0.9, attraction: 0.28, repulsion: 1.1, orbit: 0.62 }),
      createNode('effect', { name: 'Orbit Width Flange', effectType: 'flanger', movement: 'orbit', target: 'mix', baseMix: 0.06, amount: 0.26, size: 30, mass: 0.95, attraction: 0.28, repulsion: 1.1, orbit: 0.55 }),
      ...mutedNodes(MAX_AUDIO_NODES - 6),
    ],
    minimalStaticDesign: () => [
      createNode('source', { name: 'Static Sine', sourceType: 'note', behavior: 'static', motionParam: 'distance', waveform: 'sine', midiNote: 45, gain: 0.2, ampFloor: 0.8, filterCutoff: 3400, size: 46, mass: 3.0, attraction: 0.42, repulsion: 0.7, orbit: 0.04, influenceRadius: 320 }),
      createNode('source', { name: 'Fine Air', sourceType: 'noise', behavior: 'spatial-time', motionParam: 'y', gain: 0.055, ampFloor: 0.42, filterCutoff: 9000, size: 20, mass: 0.5, attraction: 0.08, repulsion: 1.2, orbit: 0.1 }),
      createNode('envelope', { name: 'Tiny Gain Detail', movement: 'nearest', target: 'sources', destination: 'amp', amount: 0.12, attack: 0.5, release: 1.8, size: 22, mass: 0.6, attraction: 0.18, repulsion: 1.0, orbit: 0.08 }),
      createNode('effect', { name: 'Subtle Room', effectType: 'reverb', movement: 'distance', target: 'mix', baseMix: 0.14, amount: 0.08, size: 32, mass: 1.0, attraction: 0.22, repulsion: 0.9, orbit: 0.06 }),
      createNode('effect', { name: 'Tone Trim', effectType: 'highpass', movement: 'y', target: 'mix', baseMix: 0, amount: 0.18, size: 26, mass: 0.7, attraction: 0.18, repulsion: 1.0, orbit: -0.05 }),
      ...mutedNodes(MAX_AUDIO_NODES - 5),
    ],
    swarmDelayField: () => [
      createNode('source', { name: 'Swarm Arp A', instrument: 'arp', rhythm: '1/16', probability: 0.62, sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', baseOctave: 4, gain: 0.14, filterCutoff: 9000, size: 22, mass: 0.55, attraction: 0.08, repulsion: 2.1, orbit: 1.15, influenceRadius: 430 }),
      createNode('source', { name: 'Swarm Arp B', instrument: 'pluck', rhythm: '1/8', probability: 0.52, sourceType: 'scale', behavior: 'spatial-time', motionParam: 'nearest', baseOctave: 5, gain: 0.13, filterCutoff: 12000, size: 22, mass: 0.5, attraction: 0.08, repulsion: 2.0, orbit: -1.05, influenceRadius: 430 }),
      createNode('source', { name: 'Swarm Noise', instrument: 'hat', rhythm: '1/16', probability: 0.5, sourceType: 'noise', behavior: 'spatial', motionParam: 'speed', gain: 0.16, ampFloor: 0.03, filterCutoff: 10000, size: 20, mass: 0.45, attraction: 0.05, repulsion: 2.2, orbit: 0.9, influenceRadius: 430 }),
      createNode('envelope', { name: 'Speed Brightener', movement: 'speed', target: 'sources', destination: 'filter', amount: 0.7, attack: 0.025, release: 0.32, size: 24, mass: 0.6, attraction: 0.1, repulsion: 1.8, orbit: -0.8 }),
      createNode('effect', { name: 'Swarm Delay', effectType: 'echo', movement: 'interaction', target: 'mix', baseMix: 0.12, amount: 0.34, time: 0.18, feedback: 0.46, size: 32, mass: 0.9, attraction: 0.18, repulsion: 1.4, orbit: 0.7 }),
      createNode('effect', { name: 'Energy Saturation', effectType: 'saturation', movement: 'energy', target: 'mix', baseMix: 0.08, amount: 0.3, size: 34, mass: 1.1, attraction: 0.24, repulsion: 1.2, orbit: 0.35 }),
      ...mutedNodes(MAX_AUDIO_NODES - 6),
    ],
    mixSpatialGlue: () => [
      createNode('source', { name: 'Warm Chord Root', sourceType: 'note', behavior: 'spatial-time', motionParam: 'distance', waveform: 'triangle', midiNote: 45, gain: 0.2, ampFloor: 0.8, filterCutoff: 4200, size: 44, mass: 2.2, attraction: 0.55, repulsion: 0.75, orbit: 0.12, influenceRadius: 380 }),
      createNode('source', { name: 'Warm Fifth', sourceType: 'note', behavior: 'spatial-time', motionParam: 'orbit', waveform: 'sine', midiNote: 52, gain: 0.16, ampFloor: 0.78, filterCutoff: 5200, size: 36, mass: 1.5, attraction: 0.38, repulsion: 0.9, orbit: 0.28 }),
      createNode('source', { name: 'Sparse Bell', instrument: 'pluck', rhythm: '1/4', probability: 0.34, sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', scale: 'amajor', baseOctave: 5, gain: 0.15, size: 22, mass: 0.6, attraction: 0.18, repulsion: 1.35, orbit: -0.38 }),
      createNode('effect', { name: 'Master Hall', effectType: 'reverb', movement: 'near', target: 'mix', baseMix: 0.24, amount: 0.22, size: 38, mass: 1.2, attraction: 0.3, repulsion: 0.9, orbit: 0.18 }),
      createNode('effect', { name: 'Master Glue', effectType: 'compressor', movement: 'energy', target: 'mix', baseMix: 0.16, amount: 0.28, size: 36, mass: 1.4, attraction: 0.36, repulsion: 0.85, orbit: 0.14 }),
      createNode('effect', { name: 'Depth Echo', effectType: 'echo', movement: 'orbit', target: 'mix', baseMix: 0.06, amount: 0.16, time: 0.42, feedback: 0.26, size: 30, mass: 0.9, attraction: 0.26, repulsion: 1.0, orbit: -0.2 }),
      ...mutedNodes(MAX_AUDIO_NODES - 6),
    ],
    heroicForestChords: () => [
      createNode('source', { name: 'Open Root Pad', sourceType: 'note', behavior: 'spatial-time', motionParam: 'distance', waveform: 'triangle', midiNote: 45, pitchDepth: 1, gain: 0.16, ampFloor: 0.88, filterCutoff: 3600, size: 50, mass: 3.0, attraction: 0.58, repulsion: 0.62, orbit: 0.06, influenceRadius: 430 }),
      createNode('source', { name: 'Lydian Third', sourceType: 'note', behavior: 'spatial-time', motionParam: 'orbit', waveform: 'sine', midiNote: 49, pitchDepth: 1, gain: 0.12, ampFloor: 0.84, filterCutoff: 4800, size: 42, mass: 2.1, attraction: 0.42, repulsion: 0.82, orbit: 0.18, influenceRadius: 380 }),
      createNode('source', { name: 'Bright Fifth', sourceType: 'note', behavior: 'spatial-time', motionParam: 'near', waveform: 'triangle', midiNote: 52, pitchDepth: 1, gain: 0.12, ampFloor: 0.82, filterCutoff: 5400, size: 38, mass: 1.7, attraction: 0.35, repulsion: 0.95, orbit: -0.14, influenceRadius: 360 }),
      createNode('source', { name: 'Raised Fourth Shimmer', sourceType: 'note', behavior: 'spatial-time', motionParam: 'y', waveform: 'sine', midiNote: 51, pitchDepth: 1, gain: 0.075, ampFloor: 0.74, filterCutoff: 8200, spacePan: true, size: 26, mass: 0.8, attraction: 0.18, repulsion: 1.28, orbit: 0.34 }),
      createNode('source', { name: 'Fairy Bell Motif', instrument: 'pluck', rhythm: '1/2', probability: 0.42, timingOffsetSource: 'orbit', timingOffsetAmount: 0.18, sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', scale: 'alydian', baseOctave: 5, waveform: 'sine', gain: 0.14, filterCutoff: 12500, size: 22, mass: 0.58, attraction: 0.16, repulsion: 1.45, orbit: -0.42 }),
      createNode('source', { name: 'Forest Air', sourceType: 'noise', behavior: 'spatial-time', motionParam: 'speed', gain: 0.04, ampFloor: 0.36, filterCutoff: 7600, size: 22, mass: 0.5, attraction: 0.08, repulsion: 1.2, orbit: 0.22 }),
      createNode('envelope', { name: 'Heroic Swell', movement: 'distance', target: 'sources', destination: 'amp', amount: 0.18, attack: 0.75, release: 2.2, size: 28, mass: 0.8, attraction: 0.24, repulsion: 0.95, orbit: 0.12 }),
      createNode('envelope', { name: 'Sunlight Filter', movement: 'y', target: 'sources', destination: 'filter', amount: 0.5, attack: 0.8, release: 2.5, size: 26, mass: 0.75, attraction: 0.22, repulsion: 1.0, orbit: -0.16 }),
      createNode('effect', { name: 'Temple Hall', effectType: 'reverb', movement: 'near', target: 'mix', baseMix: 0.3, amount: 0.22, size: 40, mass: 1.2, attraction: 0.28, repulsion: 0.9, orbit: 0.14 }),
      createNode('effect', { name: 'Soft Echo Trail', effectType: 'echo', movement: 'orbit', target: 'mix', baseMix: 0.05, amount: 0.12, time: 0.46, feedback: 0.22, size: 30, mass: 0.85, attraction: 0.22, repulsion: 1.0, orbit: -0.12 }),
      ...mutedNodes(MAX_AUDIO_NODES - 10),
    ],
    crystalPrelude: () => [
      createNode('source', { name: 'Prelude Root', sourceType: 'note', behavior: 'spatial-time', motionParam: 'distance', waveform: 'sine', midiNote: 45, pitchDepth: 1, gain: 0.13, ampFloor: 0.84, filterCutoff: 4200, size: 48, mass: 2.5, attraction: 0.52, repulsion: 0.72, orbit: 0.1, influenceRadius: 400 }),
      createNode('source', { name: 'Prelude Fifth', sourceType: 'note', behavior: 'spatial-time', motionParam: 'orbit', waveform: 'triangle', midiNote: 52, pitchDepth: 1, gain: 0.11, ampFloor: 0.82, filterCutoff: 5200, size: 40, mass: 1.8, attraction: 0.42, repulsion: 0.86, orbit: -0.16 }),
      createNode('source', { name: 'Prelude Ninth', sourceType: 'note', behavior: 'spatial-time', motionParam: 'x', waveform: 'sine', midiNote: 59, pitchDepth: 1, gain: 0.075, ampFloor: 0.78, filterCutoff: 7200, size: 30, mass: 1.0, attraction: 0.24, repulsion: 1.12, orbit: 0.28 }),
      createNode('source', { name: 'Crystal Arp', instrument: 'arp', rhythm: '1/4', probability: 0.58, timingOffsetSource: 'pushPull', timingOffsetAmount: 0.16, sourceType: 'scale', behavior: 'spatial-time', motionParam: 'nearest', scale: 'amajorpenta', baseOctave: 5, waveform: 'sine', gain: 0.13, filterCutoff: 13000, size: 22, mass: 0.55, attraction: 0.14, repulsion: 1.42, orbit: 0.45 }),
      createNode('source', { name: 'Answer Harp', instrument: 'pluck', rhythm: '1/2', probability: 0.36, timingOffsetSource: 'distance', timingOffsetAmount: 0.12, sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', scale: 'hirajoshi', baseOctave: 5, waveform: 'triangle', gain: 0.11, filterCutoff: 11800, size: 22, mass: 0.55, attraction: 0.14, repulsion: 1.45, orbit: -0.4 }),
      createNode('envelope', { name: 'Prelude Breath', movement: 'interaction', target: 'sources', destination: 'amp', amount: 0.16, attack: 0.7, release: 1.9, size: 26, mass: 0.7, attraction: 0.22, repulsion: 1.0, orbit: 0.14 }),
      createNode('envelope', { name: 'Crystal Opening', movement: 'orbit', target: 'sources', destination: 'filter', amount: 0.42, attack: 0.45, release: 1.4, size: 24, mass: 0.68, attraction: 0.2, repulsion: 1.05, orbit: -0.2 }),
      createNode('effect', { name: 'Crystal Hall', effectType: 'reverb', movement: 'distance', target: 'mix', baseMix: 0.32, amount: 0.2, size: 38, mass: 1.1, attraction: 0.28, repulsion: 0.92, orbit: 0.12 }),
      createNode('effect', { name: 'Shimmer Delay', effectType: 'echo', movement: 'angularVelocity', target: 'mix', baseMix: 0.08, amount: 0.16, time: 0.38, feedback: 0.28, size: 30, mass: 0.8, attraction: 0.22, repulsion: 1.0, orbit: -0.16 }),
      ...mutedNodes(MAX_AUDIO_NODES - 9),
    ],
  };

  window.GlidePathSetCenterMassEnabled?.(params.centerMassEnabled);
  window.GlidePathSetCenterMass?.(params.centerMass);
  window.GlidePathSetCenterMassRadius?.(params.centerMassRadius);
  window.GlidePathSetCenterMassOrbit?.(params.centerMassOrbit);

  params.nodes = presets[params.preset]();
  params.nodes.forEach((node, index) => {
    if (node.role !== 'muted') window.GlidePathAddNode?.(index, node.name || `Node ${index + 1}`, node.role, physicsConfig(node));
  });
  window.GlidePathApplyMovementPreset?.(params.movementPreset);

  const host = document.getElementById('synth-pane-host');
  const render = () => renderPanel(host, params, presets);
  render();

  host.addEventListener('input', (event) => updateFromControl(event.target, params, presets, render));
  host.addEventListener('change', (event) => updateFromControl(event.target, params, presets, render));
  window.addEventListener('glidepath:node-selected', (event) => {
    const nodeIndex = event.detail?.nodeIndex;
    if (Number.isInteger(nodeIndex) && params.selectedNode !== nodeIndex) {
      params.selectedNode = nodeIndex;
      render();
    }
  });

  document.getElementById('synth-prev-btn').addEventListener('click', () => {
    const next = window.GlidePathSelectAdjacentNode?.(-1);
    if (Number.isInteger(next)) {
      params.selectedNode = next;
      render();
    }
  });

  document.getElementById('synth-next-btn').addEventListener('click', () => {
    const next = window.GlidePathSelectAdjacentNode?.(1);
    if (Number.isInteger(next)) {
      params.selectedNode = next;
      render();
    }
  });

  document.getElementById('synth-add-btn').addEventListener('click', () => {
    if (addNode(params)) render();
  });

  document.getElementById('synth-random-btn').addEventListener('click', () => {
    const preset = params.movementPreset ?? 'orbital';
    params.nodes = randomizeNodePhysics(params.nodes, preset);
    params.nodes.forEach((node, index) => {
      if (node.role !== 'muted') window.GlidePathSyncNode?.(index, node.name || `Node ${index + 1}`, node.role, physicsConfig(node));
    });
    window.GlidePathRandomizeNodes?.(preset);
    render();
  });

  document.getElementById('synth-clear-btn').addEventListener('click', () => {
    clearNodes(params);
    render();
  });

  document.getElementById('synth-freeze-btn').addEventListener('click', (event) => {
    params.visualPaused = !params.visualPaused;
    window.GlidePathSetVisualPaused?.(params.visualPaused);
    event.currentTarget.textContent = params.visualPaused ? 'Move' : 'Freeze';
    event.currentTarget.classList.toggle('start-active', params.visualPaused);
  });

  document.getElementById('synth-trails-btn').addEventListener('click', (event) => {
    const btn = event.currentTarget;
    const current = btn.classList.contains('start-active');
    const showTrails = current; // toggle: active means trails are OFF (was frozen)
    window.GlidePathSetShowTrails?.(!current);
    btn.classList.toggle('start-active', !current);
    btn.textContent = !current ? 'Trails' : 'No Trails';
  });

  document.getElementById('synth-position-btn').addEventListener('click', () => {
    const currentIndex = SIDEBAR_POSITIONS.indexOf(sanitizeSidebarPosition(sidebar.dataset.position));
    const nextPosition = SIDEBAR_POSITIONS[(currentIndex + 1) % SIDEBAR_POSITIONS.length];
    localStorage.setItem(SIDEBAR_POSITION_STORAGE_KEY, nextPosition);
    applySidebarPosition(sidebar, openBtn, nextPosition);
  });

  document.getElementById('synth-toggle-btn').addEventListener('click', () => {
    sidebar.classList.add('synth-hidden');
    openBtn.classList.add('visible');
  });

  openBtn.addEventListener('click', () => {
    sidebar.classList.remove('synth-hidden');
    openBtn.classList.remove('visible');
  });

  document.getElementById('synth-sample-input').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const nodeIndex = Number(params.selectedNode) || 0;
    params.nodes[nodeIndex].fileName = file.name;
    refreshFileControl(params);
    window.dispatchEvent(new CustomEvent('glidepath:load-sample', { detail: { nodeIndex, file } }));
  });

  const copyBtn = document.getElementById('synth-copy-btn');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(params, null, 2));
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 1600);
    } catch {
      copyBtn.textContent = 'Failed';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    }
  });

  document.getElementById('synth-resetview-btn').addEventListener('click', () => {
    window.GlidePathResetView?.();
  });

  return { params };
}

export function updateLevelBar(value) {
  const bar = document.getElementById('synth-level-bar');
  if (bar) bar.style.width = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function setStartButtonActive(active) {
  const btn = document.getElementById('synth-start-btn');
  if (!btn) return;
  btn.textContent = active ? 'Pause' : 'Play';
  btn.classList.toggle('start-active', active);
}

export function setRecordButtonActive(active) {
  const btn = document.getElementById('synth-record-btn');
  if (!btn) return;
  btn.textContent = active ? 'Stop' : 'Record';
  btn.classList.toggle('record-active', active);
}

export function getStartButton() {
  return document.getElementById('synth-start-btn');
}

export function getRecordButton() {
  return document.getElementById('synth-record-btn');
}
