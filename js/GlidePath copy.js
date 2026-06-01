/*---------------------------------------------------------------------------
  GlidePath — Audio Motion Designer
  Physics engine & canvas renderer for N-body node interactions.
  
  Each node represents a Source, Envelope, or Effect in the audio graph.
  Their gravitational interactions drive audio parameters in real-time.
---------------------------------------------------------------------------*/

(function glidepath_engine() {

"use strict";

/*---------------------------------------------------------------------------*/
// Canvas setup
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

/*---------------------------------------------------------------------------*/
// Constants
const kMaxNumObjects = 128;
const kDefaultObjectGravity = 30;
const kTrailSize = 256;
const M_PI = Math.PI;
const M_2PI = 2 * M_PI;

// Visual
const kBackgroundColor = 'rgb(26,26,46)';
const kGridColor = 'rgba(255,255,255,0.03)';
const kCenterMarkerColor = 'rgba(255,255,255,0.08)';

// Physics
const kGravitySettings = { minG: 20, maxG: 1000, g: 500, maxV: 500 };

/*---------------------------------------------------------------------------*/
// State
let gNowMS = Date.now();
let gObjects = [];
let gGravityObjects = [];
let gNextGravityNodeID = 0;
let gVisualPaused = false;
let gShowTrails = true;

// Mouse interaction
let lastMouseX = 0;
let lastMouseY = 0;
let mouseIsDown = false;
let draggedObject = null;
let draggedObjectSavedMass = 0;

/*---------------------------------------------------------------------------*/
// Utilities
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min));
const RandomWidth = (pad) => rnd(pad, canvas.width - pad);
const RandomHeight = (pad) => rnd(pad, canvas.height - pad);
const RGB = (r, g, b) => `rgb(${r},${g},${b})`;

const NODE_COLORS = {
  source: RGB(96, 165, 250),
  envelope: RGB(34, 197, 94),
  effect: RGB(242, 106, 27),
  muted: RGB(100, 100, 115),
};

function ColorForRole(role) {
  return NODE_COLORS[role] || NODE_COLORS.muted;
}

/*---------------------------------------------------------------------------*/
// Object class — physics entity
class PhysicsObject {
  constructor(x, y, color, size) {
    this.x = x;
    this.y = y;
    this.velX = 0;
    this.velY = 0;
    this.accX = 0;
    this.accY = 0;
    this.lastAccX = 0;
    this.lastAccY = 0;
    this.color = color;
    this.size = size;
    this.mass = 0;
    this.trail = [];
    this.alive = true;
    this.isFixed = false;
    this.isBeingDragged = false;
    this.isGravityObject = false;
    this.hasTrail = false;
    this.trailColor = 'rgba(255,255,255,0.3)';
    this.nodeId = -1;
    this.nodeName = '';
    this.nodeRole = 'muted';

    gObjects.push(this);
  }

  isActive() { return this.alive; }
  hasGravity() { return this.mass > 0; }

  isPointInside(x, y, margin) {
    const r = this.size + margin;
    const dx = x - this.x;
    const dy = y - this.y;
    return (dx * dx + dy * dy) <= (r * r);
  }

  resetAcceleration() {
    if (this.hasGravity()) {
      this.accX = 0;
      this.accY = 0;
    }
  }

  applyPhysics(delta) {
    if (this.isFixed || this.isBeingDragged) {
      this.lastAccX = 0;
      this.lastAccY = 0;
      return;
    }

    const prevVelX = this.velX;
    const prevVelY = this.velY;

    this.velX += this.accX * delta;
    this.velY += this.accY * delta;
    this.lastAccX = delta > 0 ? (this.velX - prevVelX) / delta : 0;
    this.lastAccY = delta > 0 ? (this.velY - prevVelY) / delta : 0;

    // Bound velocity
    const maxV = kGravitySettings.maxV;
    if (maxV > 0) {
      this.velX = Math.max(-maxV, Math.min(maxV, this.velX));
      this.velY = Math.max(-maxV, Math.min(maxV, this.velY));
    }

    this.x += this.velX * delta;
    this.y += this.velY * delta;
  }

  draw() {
    const color = ColorForRole(this.nodeRole);
    const r = this.size;

    ctx.save();

    // Glow
    ctx.shadowBlur = 22;
    ctx.shadowColor = color;

    // Outer ring
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, M_2PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.fill();

    // Inner circle
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.7, 0, M_2PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Border
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, M_2PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();

    // Role icon
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = this.nodeRole === 'source' ? '♪' : this.nodeRole === 'envelope' ? '⊿' : this.nodeRole === 'effect' ? '◈' : '○';
    ctx.fillText(icon, this.x, this.y - 4);

    // Name label
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(this.nodeName || `Node ${this.nodeId + 1}`, this.x, this.y + 10);

    ctx.restore();
  }

  drawTrail() {
    if (!this.hasTrail || this.isFixed || !gShowTrails) {
      this.trail = [];
      return;
    }

    this.trail.shift();
    this.trail[kTrailSize - 1] = { x: this.x, y: this.y };

    ctx.save();
    ctx.strokeStyle = this.trailColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();

    let started = false;
    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      if (!pt) continue;
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/*---------------------------------------------------------------------------*/
// Gravity physics
function ApplyGravity(o1, o2) {
  if (!(o1.hasGravity() && o2.hasGravity())) return;

  const dx = o2.x - o1.x;
  const dy = o2.y - o1.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;

  const { minG, maxG, g } = kGravitySettings;
  let gravity = (g * o1.mass * o2.mass) / (d * d);
  gravity = Math.max(minG, Math.min(maxG, gravity));

  const angle = Math.atan2(dx, dy);
  const ax = gravity * Math.sin(angle);
  const ay = gravity * Math.cos(angle);

  o1.accX += ax;
  o1.accY += ay;
  o2.accX -= ax;
  o2.accY -= ay;
}

/*---------------------------------------------------------------------------*/
// Mouse interaction
function handleMouseDown(e) {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  mouseIsDown = true;
}

function handleMouseUp() {
  if (draggedObject) {
    draggedObject.isBeingDragged = false;
    draggedObject.mass = draggedObjectSavedMass;
    draggedObject = null;
  }
  canvas.style.cursor = 'default';
  mouseIsDown = false;
}

function handleMouseMove(e) {
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  let targetObject = draggedObject;

  if (!targetObject) {
    for (const obj of gGravityObjects) {
      if (obj.isActive() && obj.isPointInside(mouseX, mouseY, 8)) {
        targetObject = obj;
        break;
      }
    }
  }

  canvas.style.cursor = targetObject ? 'grab' : 'default';

  if (mouseIsDown) {
    if (targetObject && !draggedObject) {
      draggedObject = targetObject;
      draggedObject.isBeingDragged = true;
      draggedObjectSavedMass = draggedObject.mass;
      draggedObject.mass = kDefaultObjectGravity * 4;
      canvas.style.cursor = 'grabbing';
    }

    if (draggedObject) {
      draggedObject.x += (mouseX - lastMouseX);
      draggedObject.y += (mouseY - lastMouseY);
      canvas.style.cursor = 'grabbing';
    }
  }

  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

/*---------------------------------------------------------------------------*/
// Node management
function NewGravityNode(x, y, mass, nodeIndex, nodeName, nodeRole) {
  const obj = new PhysicsObject(x, y, ColorForRole(nodeRole), 32);
  obj.nodeId = nodeIndex ?? gNextGravityNodeID++;
  obj.nodeName = nodeName || `Node ${obj.nodeId + 1}`;
  obj.nodeRole = nodeRole || 'muted';
  obj.mass = mass;
  obj.isGravityObject = true;
  obj.hasTrail = true;
  obj.trailColor = ColorForRole(nodeRole);
  obj.isFixed = false;
  return obj;
}

function AddNode(nodeIndex, nodeName, nodeRole) {
  const existing = gGravityObjects.find(o => o.nodeId === nodeIndex && o.alive);
  if (existing) {
    SyncNodeConfig(nodeIndex, nodeName, nodeRole);
    return existing.nodeId;
  }

  const x = RandomWidth(120);
  const y = RandomHeight(120);
  const obj = NewGravityNode(x, y, kDefaultObjectGravity, nodeIndex, nodeName, nodeRole);
  gGravityObjects.push(obj);
  return obj.nodeId;
}

function SyncNodeConfig(nodeIndex, nodeName, nodeRole) {
  for (const obj of gGravityObjects) {
    if (obj.nodeId === nodeIndex) {
      obj.nodeName = nodeName || `Node ${nodeIndex + 1}`;
      obj.nodeRole = nodeRole || 'muted';
      obj.color = ColorForRole(obj.nodeRole);
      obj.trailColor = ColorForRole(obj.nodeRole);
    }
  }
}

function RemoveNode(nodeIndex) {
  for (const obj of gGravityObjects) {
    if (obj.nodeId === nodeIndex) {
      obj.alive = false;
    }
  }
  gGravityObjects = gGravityObjects.filter(o => o.alive);
  gObjects = gObjects.filter(o => o.alive);
}

function ClearNodes() {
  for (const obj of gGravityObjects) obj.alive = false;
  gGravityObjects = [];
  gObjects = gObjects.filter(o => o.alive);
}

function SetVisualPaused(paused) {
  gVisualPaused = !!paused;
}

function SetShowTrails(show) {
  gShowTrails = !!show;
}

// Expose API
window.GlidePathAddNode = AddNode;
window.GlidePathEnsureNode = AddNode;
window.GlidePathSyncNode = SyncNodeConfig;
window.GlidePathClearNodes = ClearNodes;
window.GlidePathRemoveNode = RemoveNode;
window.GlidePathSetVisualPaused = SetVisualPaused;
window.GlidePathSetShowTrails = SetShowTrails;

/*---------------------------------------------------------------------------*/
// Drawing helpers
function DrawBackground() {
  ctx.fillStyle = kBackgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid
  ctx.save();
  ctx.strokeStyle = kGridColor;
  ctx.lineWidth = 1;
  const gridSize = 60;
  for (let x = gridSize; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = gridSize; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Center crosshair
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.save();
  ctx.strokeStyle = kCenterMarkerColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy);
  ctx.lineTo(cx + 30, cy);
  ctx.moveTo(cx, cy - 30);
  ctx.lineTo(cx, cy + 30);
  ctx.stroke();
  ctx.restore();
}

function DrawEmptyState() {
  if (gGravityObjects.length > 0) return;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Add nodes to begin designing audio motion', canvas.width / 2, canvas.height / 2);
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillText('Use the sidebar to add Source, Envelope, and Effect nodes', canvas.width / 2, canvas.height / 2 + 28);
  ctx.restore();
}

/*---------------------------------------------------------------------------*/
// Main frame
function DoOneFrame() {
  const nowMS = Date.now();
  const deltaMS = nowMS - gNowMS;
  gNowMS = nowMS;
  const deltaS = gVisualPaused ? 0 : deltaMS / 1000;

  // Draw
  DrawBackground();
  DrawEmptyState();

  // Physics: object pair interactions
  const activeObjects = gGravityObjects.filter(o => o.isActive());
  for (let i = 0; i < activeObjects.length - 1; i++) {
    for (let j = i + 1; j < activeObjects.length; j++) {
      ApplyGravity(activeObjects[i], activeObjects[j]);
    }
  }

  // Update and draw all objects
  for (const obj of gObjects) {
    if (!obj.isActive()) continue;
    obj.applyPhysics(deltaS);
    obj.resetAcceleration();
    obj.draw();
    obj.drawTrail();
  }

  // Expose reactive state for the audio engine
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  const gravObjs = activeObjects.map((o, index) => {
    const dx = o.x - cx;
    const dy = o.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const vx = o.velX || 0;
    const vy = o.velY || 0;
    const ax = o.lastAccX || 0;
    const ay = o.lastAccY || 0;

    let nearestDist = maxDist;
    for (const other of activeObjects) {
      if (other === o) continue;
      nearestDist = Math.min(nearestDist, Math.hypot(other.x - o.x, other.y - o.y));
    }

    const angularVelocity = dist > 1 ? (vx * dy - vy * dx) / (dist * dist * 60) : 0;

    return {
      id: o.nodeId,
      index,
      name: o.nodeName,
      role: o.nodeRole,
      x: o.x / canvas.width,
      y: o.y / canvas.height,
      dist: dist / maxDist,
      interaction: 1 - Math.min(1, nearestDist / maxDist),
      angle: ((Math.atan2(dy, dx) * 180 / M_PI) + 360) % 360,
      speed: Math.sqrt(vx * vx + vy * vy) / 400,
      acceleration: Math.sqrt(ax * ax + ay * ay) / 1000,
      angularVelocity: Math.max(-1, Math.min(1, angularVelocity)),
      vx: vx / 400,
      vy: vy / 400,
      ax: ax / 1000,
      ay: ay / 1000,
    };
  });

  const sysEnergy = gravObjs.length
    ? gravObjs.reduce((s, o) => s + o.speed, 0) / gravObjs.length
    : 0;

  window.GlidePath = {
    gravityMode: true,
    gravityObjects: gravObjs,
    systemEnergy: sysEnergy,
    objectCount: gravObjs.length,
    timeSeconds: gNowMS / 1000,
  };
}

/*---------------------------------------------------------------------------*/
// Event loop
function EventLoop() {
  DoOneFrame();
  requestAnimationFrame(EventLoop);
}

EventLoop();

})();
