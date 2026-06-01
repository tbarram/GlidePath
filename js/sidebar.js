const MAX_AUDIO_NODES = 12;
const SIDEBAR_POSITIONS = ['right', 'left', 'top', 'bottom'];
const SIDEBAR_POSITION_STORAGE_KEY = 'glidepath:sidebar-position';
const SIDEBAR_POSITION_LABELS = { right: 'Right', left: 'Left', top: 'Top', bottom: 'Bottom' };

const SOURCE_OPTIONS = { Scale: 'scale', Note: 'note', Noise: 'noise', 'Audio File': 'file' };
const ROLE_OPTIONS = { Source: 'source', Envelope: 'envelope', Effect: 'effect', Muted: 'muted' };
const BEHAVIOR_OPTIONS = { Static: 'static', Spatial: 'spatial', Time: 'time', Random: 'random', 'Spatial + Time': 'spatial-time' };
const MOVEMENT_OPTIONS = {
  Distance: 'distance',
  Interaction: 'interaction',
  Nearness: 'near',
  Speed: 'speed',
  Acceleration: 'acceleration',
  'X Axis': 'x',
  'Y Axis': 'y',
  Angle: 'angle',
  'Angular Velocity': 'angularVelocity',
  Energy: 'energy',
  Time: 'time',
};
const TARGET_OPTIONS = Object.fromEntries([
  ['All Sources', 'sources'],
  ['General Mix', 'mix'],
  ...Array.from({ length: MAX_AUDIO_NODES }, (_, i) => [`Node ${i + 1}`, `node-${i}`]),
]);

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
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.045);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 9px;
  }

  .node-section h3 {
    margin: 0 0 9px;
    color: rgba(255,255,255,0.82);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .node-row {
    display: grid;
    grid-template-columns: 104px minmax(0, 1fr) 42px;
    align-items: center;
    gap: 8px;
    min-height: 30px;
    color: rgba(255,255,255,0.52);
    font-size: 10px;
  }

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

  .synth-footer-row { display: flex; gap: 6px; }

  .synth-btn {
    flex: 1;
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
    sourceType: 'scale',
    behavior: 'spatial',
    motionParam: 'angle',
    scale: 'aminor',
    baseOctave: 2,
    waveform: 'sine',
    midiNote: 57,
    pitchDepth: 7,
    gain: 0.45,
    filterCutoff: 8000,
    spacePan: true,
    staticPan: 0,
    movement: 'distance',
    target: 'sources',
    destination: 'amp',
    amount: 0.45,
    attack: 0.04,
    release: 0.22,
    polarity: 'positive',
    effectType: 'reverb',
    baseMix: 0.1,
    time: 0.25,
    feedback: 0.35,
    fileName: '',
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
    row('Source', select('node', 'sourceType', node.sourceType, SOURCE_OPTIONS)),
    row('Mode', select('node', 'behavior', node.behavior, BEHAVIOR_OPTIONS)),
    row('Motion', select('node', 'motionParam', node.motionParam, MOVEMENT_OPTIONS)),
    row('Gain', range('node', 'gain', node.gain, 0, 1, 0.01), Number(node.gain).toFixed(2)),
    row('Filter', range('node', 'filterCutoff', node.filterCutoff, 120, 16000, 10), Math.round(node.filterCutoff)),
    row('Space Pan', checkbox('node', 'spacePan', node.spacePan)),
  ];

  if (node.sourceType === 'scale') {
    controls.push(
      row('Scale', select('node', 'scale', node.scale, { 'A Minor': 'aminor', 'A Minor Penta': 'aminorpenta', 'A Major': 'amajor', 'A Dorian': 'adorian', 'D Minor': 'dminor' })),
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
    row('Motion', select('node', 'movement', node.movement, MOVEMENT_OPTIONS)),
    row('Affects', select('node', 'destination', node.destination, { Amplitude: 'amp', Pitch: 'pitch', Filter: 'filter', Pan: 'pan' })),
    row('Polarity', select('node', 'polarity', node.polarity, { Positive: 'positive', Inverse: 'inverse' })),
    row('Amount', range('node', 'amount', node.amount, 0, 1.5, 0.01), Number(node.amount).toFixed(2)),
    row('Attack', range('node', 'attack', node.attack, 0.005, 1.5, 0.005), Number(node.attack).toFixed(2)),
    row('Release', range('node', 'release', node.release, 0.005, 2.5, 0.005), Number(node.release).toFixed(2)),
  ].join('');
}

function renderEffect(node) {
  const controls = [
    row('Effect', select('node', 'effectType', node.effectType, { Reverb: 'reverb', Echo: 'echo', Flanger: 'flanger', Filter: 'filter', Compressor: 'compressor' })),
    row('Target', select('node', 'target', node.target, TARGET_OPTIONS)),
    row('Motion', select('node', 'movement', node.movement, MOVEMENT_OPTIONS)),
    row('Base Mix', range('node', 'baseMix', node.baseMix, 0, 1, 0.01), Number(node.baseMix).toFixed(2)),
    row('Motion Mix', range('node', 'amount', node.amount, 0, 1, 0.01), Number(node.amount).toFixed(2)),
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

function syncVisualNode(params, index = Number(params.selectedNode) || 0) {
  const node = params.nodes[index];
  if (node?.role && node.role !== 'muted') {
    window.GlidePathEnsureNode?.(index, node.name || `Node ${index + 1}`, node.role);
    return;
  }
  window.GlidePathRemoveNode?.(index);
  window.GlidePathSyncNode?.(index, node?.name || `Node ${index + 1}`, node?.role || 'muted');
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
  window.GlidePathAddNode?.(index, params.nodes[index].name, params.nodes[index].role);
  return true;
}

function clearNodes(params) {
  params.nodes = createDefaultNodes();
  params.selectedNode = 0;
  window.GlidePathClearNodes?.();
}

const BORDER_MODE_OPTIONS = { Repel: 'repel', Bounce: 'bounce', Wrap: 'wrap', None: 'none' };

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
    <section class="node-section">
      <h3>Global</h3>
      ${row('Preset', select('params', 'preset', params.preset, { 'Blank': 'blank', 'Sparse Motion': 'sparseMotion', 'Impact Texture': 'impactTexture' }))}
      ${row('Input Trim', range('params', 'masterVolume', params.masterVolume, 0, 1, 0.01), Number(params.masterVolume).toFixed(2))}
      ${row('Output', range('params', 'outputGain', params.outputGain, 0, 1.2, 0.01), Number(params.outputGain).toFixed(2))}
      ${row('Scale', select('params', 'globalScale', params.globalScale, { 'A Minor': 'aminor', 'A Minor Penta': 'aminorpenta', 'A Major': 'amajor', 'A Dorian': 'adorian', 'D Minor': 'dminor' }))}
    </section>
    <section class="node-section">
      <h3>Physics</h3>
      ${row('Gravity', range('physics', 'gravity', params.gravity ?? 500, 10, 2000, 10), Math.round(params.gravity ?? 500))}
      ${row('Damping', range('physics', 'damping', params.damping ?? 0.998, 0.9, 1.0, 0.001), Number(params.damping ?? 0.998).toFixed(3))}
      ${row('Border', select('physics', 'borderMode', params.borderMode ?? 'repel', BORDER_MODE_OPTIONS))}
      ${row('Margin', range('physics', 'borderMargin', params.borderMargin ?? 60, 10, 200, 5), Math.round(params.borderMargin ?? 60))}
    </section>
    <section class="node-section">
      <h3>Node ${selectedIndex + 1}${node.name ? ` — ${node.name}` : ''}</h3>
      ${Object.keys(nodeOptions).length > 1 ? row('Edit', select('params', 'selectedNode', String(selectedIndex), nodeOptions)) : ''}
      ${row('Name', text('node', 'name', node.name || ''))}
      ${row('Type', select('node', 'role', node.role, ROLE_OPTIONS))}
      ${row('Enabled', checkbox('node', 'enabled', node.enabled))}
      ${nodeControls}
    </section>
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
    const output = element.parentElement?.querySelector('output');
    if (output && (element.type === 'range' || element.type === 'number')) output.textContent = Number(value).toFixed(value < 10 ? 3 : 0);
    return;
  }

  const target = scope === 'node' ? selectedNode(params) : params;
  target[prop] = value;

  if (scope === 'params' && prop === 'preset') {
    params.nodes = presets[value]();
    params.selectedNode = 0;
    window.GlidePathClearNodes?.();
    params.nodes.forEach((node, index) => {
      if (node.role !== 'muted') window.GlidePathAddNode?.(index, node.name || `Node ${index + 1}`, node.role);
    });
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
      <div class="synth-footer-row">
        <button class="synth-btn" id="synth-add-btn">Add Node</button>
        <button class="synth-btn" id="synth-freeze-btn">Freeze</button>
        <button class="synth-btn" id="synth-trails-btn">Trails</button>
        <button class="synth-btn" id="synth-clear-btn">Clear</button>
      </div>
      <div class="synth-footer-row">
        <button class="synth-btn" id="synth-start-btn">Play</button>
        <button class="synth-btn" id="synth-record-btn">Record</button>
        <button class="synth-btn" id="synth-copy-btn">Copy</button>
        <button class="synth-btn" id="synth-resetview-btn">Reset View</button>
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
    preset: 'blank',
    selectedNode: 0,
    visualPaused: false,
    masterVolume: 0.68,
    outputGain: 0.85,
    globalScale: 'aminor',
    baseOctave: 2,
    gravity: 500,
    damping: 0.998,
    borderMode: 'repel',
    borderMargin: 60,
    nodes: createDefaultNodes(),
  };

  const presets = {
    blank: createDefaultNodes,
    sparseMotion: () => [
      createNode('source', { name: 'Orbit Tone', sourceType: 'scale', behavior: 'spatial', motionParam: 'angle', waveform: 'triangle', gain: 0.32 }),
      createNode('source', { name: 'Low Drone', sourceType: 'note', behavior: 'time', waveform: 'sine', midiNote: 33, gain: 0.28 }),
      createNode('envelope', { name: 'Near Filter', movement: 'near', target: 'sources', destination: 'filter', amount: 0.8, attack: 0.05, release: 0.7 }),
      createNode('effect', { name: 'Space Verb', effectType: 'reverb', movement: 'distance', target: 'mix', baseMix: 0.18, amount: 0.45 }),
      ...Array.from({ length: MAX_AUDIO_NODES - 4 }, () => createNode('muted')),
    ],
    impactTexture: () => [
      createNode('source', { name: 'Motion Noise', sourceType: 'noise', behavior: 'spatial', motionParam: 'speed', filterCutoff: 1900, gain: 0.42 }),
      createNode('source', { name: 'Impact Root', sourceType: 'note', behavior: 'spatial', motionParam: 'near', waveform: 'sawtooth', midiNote: 36, pitchDepth: 19, gain: 0.3 }),
      createNode('envelope', { name: 'Acceleration Hit', movement: 'acceleration', target: 'sources', destination: 'amp', amount: 0.9, attack: 0.01, release: 0.16 }),
      createNode('effect', { name: 'Spin Flange', effectType: 'flanger', movement: 'angularVelocity', target: 'sources', baseMix: 0.12, amount: 0.6 }),
      createNode('effect', { name: 'Energy Glue', effectType: 'compressor', movement: 'energy', target: 'mix', baseMix: 0.2, amount: 0.7 }),
      ...Array.from({ length: MAX_AUDIO_NODES - 5 }, () => createNode('muted')),
    ],
  };

  const host = document.getElementById('synth-pane-host');
  const render = () => renderPanel(host, params, presets);
  render();

  host.addEventListener('input', (event) => updateFromControl(event.target, params, presets, render));
  host.addEventListener('change', (event) => updateFromControl(event.target, params, presets, render));

  document.getElementById('synth-add-btn').addEventListener('click', () => {
    if (addNode(params)) render();
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
