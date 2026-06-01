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
const kDefaultObjectGravity = 30;
const kTrailSize = 256;
const M_PI = Math.PI;
const M_2PI = 2 * M_PI;

// Visual
const kBackgroundColor = 'rgb(26,26,46)';
const kGridColor = 'rgba(255,255,255,0.03)';
const kCenterMarkerColor = 'rgba(255,255,255,0.08)';
const kBorderColor = 'rgba(255,255,255,0.12)';
const kBorderRepelColor = 'rgba(242,106,27,0.15)';

/*---------------------------------------------------------------------------*/
// Configurable state
const gPhysics = {
  g: 500,
  minG: 20,
  maxG: 1000,
  maxV: 420,
  damping: 0.992,         // velocity damping per frame (1 = none, 0.99 = subtle, 0.95 = heavy)
  borderMode: 'repel',    // 'repel', 'wrap', 'bounce', 'none'
  borderRepelStrength: 800,
  borderMargin: 80,       // distance from edge where border force begins
  ambientMotion: 0.18,    // tiny procedural drift that prevents dead/static systems
  centerBias: 0.025,      // gentle containment, not a strong center attractor
  separation: 1.0,
  centerMassEnabled: true,
  centerMass: 1.2,
  centerMassRadius: 96,
  centerMassOrbit: 0.34,
};

const DEFAULT_NODE_PHYSICS = Object.freeze({
  size: 30,
  mass: 1,
  gravity: 1,
  attraction: 0.42,
  repulsion: 0.95,
  orbit: 0.32,
  influenceRadius: 260,
});

const MOVEMENT_PRESETS = {
  calm: { g: 300, damping: 0.994, maxV: 260, ambientMotion: 0.14, centerBias: 0.018, separation: 1.1 },
  orbital: { g: 520, damping: 0.992, maxV: 420, ambientMotion: 0.16, centerBias: 0.02, separation: 1.0 },
  chaotic: { g: 760, damping: 0.986, maxV: 620, ambientMotion: 0.34, centerBias: 0.012, separation: 1.25 },
  clustered: { g: 440, damping: 0.99, maxV: 360, ambientMotion: 0.18, centerBias: 0.035, separation: 0.82 },
  scattered: { g: 380, damping: 0.993, maxV: 360, ambientMotion: 0.2, centerBias: 0.008, separation: 1.55 },
  heavy: { g: 680, damping: 0.988, maxV: 320, ambientMotion: 0.1, centerBias: 0.03, separation: 1.05, centerMassEnabled: true, centerMass: 2.2, centerMassRadius: 130, centerMassOrbit: 0.22 },
  minimal: { g: 180, damping: 0.997, maxV: 140, ambientMotion: 0.055, centerBias: 0.012, separation: 1.2, centerMassEnabled: true, centerMass: 0.35, centerMassRadius: 180, centerMassOrbit: 0.08 },
  aggressive: { g: 1180, damping: 0.978, maxV: 860, ambientMotion: 0.48, centerBias: 0.008, separation: 1.42, centerMassEnabled: true, centerMass: 1.7, centerMassRadius: 82, centerMassOrbit: 0.95 },
  swarm: { g: 900, damping: 0.982, maxV: 740, ambientMotion: 0.38, centerBias: 0.006, separation: 1.6, centerMassEnabled: true, centerMass: 0.9, centerMassRadius: 110, centerMassOrbit: -0.75 },
};

// Zoom / pan state
let gZoom = 1.0;
let gPanX = 0;
let gPanY = 0;
const kMinZoom = 0.3;
const kMaxZoom = 3.0;

/*---------------------------------------------------------------------------*/
// State
let gNowMS = Date.now();
let gObjects = [];
let gGravityObjects = [];
let gNextGravityNodeID = 0;
let gSelectedNodeId = null;
let gVisualPaused = false;
let gShowTrails = true;

// Mouse interaction
let lastMouseX = 0;
let lastMouseY = 0;
let mouseIsDown = false;
let draggedObject = null;
let draggedObjectSavedMass = 0;
let isPanning = false; // middle-mouse or space+drag pans the view

/*---------------------------------------------------------------------------*/
// Utilities
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min));
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
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

// Convert screen coords to world coords (accounting for zoom/pan)
function screenToWorld(sx, sy) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  return {
    x: (sx - cx - gPanX) / gZoom + cx,
    y: (sy - cy - gPanY) / gZoom + cy,
  };
}

// Convert world coords to screen coords
function worldToScreen(wx, wy) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  return {
    x: (wx - cx) * gZoom + cx + gPanX,
    y: (wy - cy) * gZoom + cy + gPanY,
  };
}

// Random position within the visible world area (with padding)
function RandomWorldX(pad) {
  const cx = canvas.width / 2;
  const halfW = (canvas.width / 2) / gZoom;
  return cx + rnd(-halfW + pad, halfW - pad);
}
function RandomWorldY(pad) {
  const cy = canvas.height / 2;
  const halfH = (canvas.height / 2) / gZoom;
  return cy + rnd(-halfH + pad, halfH - pad);
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
    this.interaction = 0;
    this.nearestDistance = 0;
    this.pairPull = 0;
    this.pairPush = 0;
    this.orbitEnergy = 0;
    this.physics = { ...DEFAULT_NODE_PHYSICS };

    gObjects.push(this);
  }

  isActive() { return this.alive; }
  hasGravityMass() { return this.mass > 0; }
  radius() { return this.size; }

  isPointInside(worldX, worldY, margin) {
    const r = this.size + margin;
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    return (dx * dx + dy * dy) <= (r * r);
  }

  resetAcceleration() {
    if (this.hasGravityMass()) {
      this.accX = 0;
      this.accY = 0;
    }
  }

  applyPhysics(delta) {
    if (this.isFixed || this.isBeingDragged) {
      this.lastAccX = 0;
      this.lastAccY = 0;
      // When dragged, zero out velocity so node doesn't fly off on release
      this.velX = 0;
      this.velY = 0;
      return;
    }

    const prevVelX = this.velX;
    const prevVelY = this.velY;

    // Apply acceleration
    this.velX += this.accX * delta;
    this.velY += this.accY * delta;

    // Velocity damping — keeps orbits from growing indefinitely
    this.velX *= gPhysics.damping;
    this.velY *= gPhysics.damping;

    // Compute actual acceleration for audio readout
    this.lastAccX = delta > 0 ? (this.velX - prevVelX) / delta : 0;
    this.lastAccY = delta > 0 ? (this.velY - prevVelY) / delta : 0;

    // Bound velocity
    const maxV = gPhysics.maxV;
    if (maxV > 0) {
      const speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
      if (speed > maxV) {
        const scale = maxV / speed;
        this.velX *= scale;
        this.velY *= scale;
      }
    }

    this.x += this.velX * delta;
    this.y += this.velY * delta;

    // Apply border behavior
    this.applyBorder();
  }

  applyBorder() {
    const margin = gPhysics.borderMargin;
    const w = canvas.width;
    const h = canvas.height;

    switch (gPhysics.borderMode) {
      case 'repel': {
        const strength = gPhysics.borderRepelStrength;
        // Left
        if (this.x < margin) {
          const penetration = (margin - this.x) / margin;
          this.velX += strength * penetration * 0.016;
        }
        // Right
        if (this.x > w - margin) {
          const penetration = (this.x - (w - margin)) / margin;
          this.velX -= strength * penetration * 0.016;
        }
        // Top
        if (this.y < margin) {
          const penetration = (margin - this.y) / margin;
          this.velY += strength * penetration * 0.016;
        }
        // Bottom
        if (this.y > h - margin) {
          const penetration = (this.y - (h - margin)) / margin;
          this.velY -= strength * penetration * 0.016;
        }
        break;
      }
      case 'bounce': {
        const r = this.size;
        if (this.x < r) { this.x = r; this.velX = Math.abs(this.velX) * 0.7; }
        if (this.x > w - r) { this.x = w - r; this.velX = -Math.abs(this.velX) * 0.7; }
        if (this.y < r) { this.y = r; this.velY = Math.abs(this.velY) * 0.7; }
        if (this.y > h - r) { this.y = h - r; this.velY = -Math.abs(this.velY) * 0.7; }
        break;
      }
      case 'wrap': {
        if (this.x < -margin) this.x = w + margin;
        else if (this.x > w + margin) this.x = -margin;
        if (this.y < -margin) this.y = h + margin;
        else if (this.y > h + margin) this.y = -margin;
        break;
      }
      // 'none' — no boundary behavior
    }
  }

  draw() {
    const color = ColorForRole(this.nodeRole);
    const r = this.size * gZoom;
    const screen = worldToScreen(this.x, this.y);
    const sx = screen.x;
    const sy = screen.y;

    ctx.save();

    // Glow
    ctx.shadowBlur = 22 * gZoom;
    ctx.shadowColor = color;

    // Outer ring
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, M_2PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.fill();

    const selected = this.nodeId === gSelectedNodeId;

    if (selected) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 8 * gZoom, 0, M_2PI);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.stroke();
    }

    // Inner circle
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.7, 0, M_2PI);
    ctx.fillStyle = color;
    ctx.fill();

    // Border ring
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, M_2PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();

    // Role icon
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `bold ${Math.round(10 * gZoom)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = this.nodeRole === 'source' ? '♪' : this.nodeRole === 'envelope' ? '⊿' : this.nodeRole === 'effect' ? '◈' : '○';
    ctx.fillText(icon, sx, sy - 4 * gZoom);

    // Name label
    ctx.font = `${Math.round(10 * gZoom)}px monospace`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(this.nodeName || `Node ${this.nodeId + 1}`, sx, sy + 10 * gZoom);

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
    ctx.lineWidth = 1.5 * gZoom;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();

    let started = false;
    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      if (!pt) continue;
      const screen = worldToScreen(pt.x, pt.y);
      if (!started) { ctx.moveTo(screen.x, screen.y); started = true; }
      else ctx.lineTo(screen.x, screen.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/*---------------------------------------------------------------------------*/
// Interaction physics: bounded attraction + close-range separation + tangential orbit.
// This deliberately avoids pure inverse-square gravity, which collapses nodes into
// the same center point and produces static audio modulation.
function ResetInteractionMetrics(objects) {
  for (const obj of objects) {
    obj.interaction = 0;
    obj.nearestDistance = Infinity;
    obj.pairPull = 0;
    obj.pairPush = 0;
    obj.orbitEnergy = 0;
  }
}

function ApplyNodeInteraction(o1, o2) {
  if (!(o1.hasGravityMass() && o2.hasGravityMass())) return;

  let dx = o2.x - o1.x;
  let dy = o2.y - o1.y;
  let d = Math.hypot(dx, dy);

  // If nodes are exactly stacked, pick a deterministic tiny direction so the
  // solver can separate them instead of locking into NaN/zero-force state.
  if (d < 0.001) {
    const angle = ((o1.nodeId + 1) * 2.399963 + (o2.nodeId + 1)) % M_2PI;
    dx = Math.cos(angle);
    dy = Math.sin(angle);
    d = 1;
  }

  const nx = dx / d;
  const ny = dy / d;
  const tx = -ny;
  const ty = nx;
  const p1 = o1.physics ?? DEFAULT_NODE_PHYSICS;
  const p2 = o2.physics ?? DEFAULT_NODE_PHYSICS;
  const minSeparation = (o1.radius() + o2.radius() + 24) * gPhysics.separation;
  const influence = Math.max(minSeparation + 80, (p1.influenceRadius + p2.influenceRadius) * 0.5);
  const proximity = clamp(1 - d / influence, 0, 1);
  const overlap = clamp((minSeparation - d) / minSeparation, 0, 1);

  o1.nearestDistance = Math.min(o1.nearestDistance, d);
  o2.nearestDistance = Math.min(o2.nearestDistance, d);
  o1.interaction = Math.max(o1.interaction, proximity);
  o2.interaction = Math.max(o2.interaction, proximity);

  if (proximity <= 0 && overlap <= 0) return;

  const massMix = Math.sqrt(o1.mass * o2.mass);
  const attract = gPhysics.g * 0.045 * massMix * (p1.attraction + p2.attraction) * 0.5 * proximity;
  const repel = gPhysics.g * 0.16 * massMix * (p1.repulsion + p2.repulsion) * 0.5 * (overlap * overlap + Math.pow(proximity, 3) * 0.18);
  const orbit = gPhysics.g * 0.025 * massMix * (p1.orbit + p2.orbit) * 0.5 * proximity;
  const signedForce = clamp(attract - repel, -gPhysics.maxG, gPhysics.maxG);
  const orbitForce = clamp(orbit, -gPhysics.maxG * 0.45, gPhysics.maxG * 0.45);
  const invM1 = 1 / Math.max(0.25, o1.mass);
  const invM2 = 1 / Math.max(0.25, o2.mass);

  o1.accX += (nx * signedForce + tx * orbitForce) * invM1;
  o1.accY += (ny * signedForce + ty * orbitForce) * invM1;
  o2.accX -= (nx * signedForce + tx * orbitForce) * invM2;
  o2.accY -= (ny * signedForce + ty * orbitForce) * invM2;

  const pullMetric = Math.max(0, signedForce) / Math.max(1, gPhysics.maxG);
  const pushMetric = Math.max(0, -signedForce) / Math.max(1, gPhysics.maxG);
  const orbitMetric = Math.abs(orbitForce) / Math.max(1, gPhysics.maxG);
  o1.pairPull = Math.max(o1.pairPull, pullMetric);
  o2.pairPull = Math.max(o2.pairPull, pullMetric);
  o1.pairPush = Math.max(o1.pairPush, pushMetric);
  o2.pairPush = Math.max(o2.pairPush, pushMetric);
  o1.orbitEnergy = Math.max(o1.orbitEnergy, orbitMetric);
  o2.orbitEnergy = Math.max(o2.orbitEnergy, orbitMetric);
}

function ApplyAmbientMotion(obj, timeSeconds) {
  if (!obj.hasGravityMass() || obj.isBeingDragged || obj.isFixed) return;
  const p = obj.physics ?? DEFAULT_NODE_PHYSICS;
  const wobble = gPhysics.ambientMotion * 42 * Math.max(0.2, p.gravity);
  const phase = (obj.nodeId + 1) * 12.9898;
  obj.accX += Math.sin(timeSeconds * (0.27 + p.orbit * 0.16) + phase) * wobble;
  obj.accY += Math.cos(timeSeconds * (0.23 + p.attraction * 0.12) + phase * 0.73) * wobble;

  // Very gentle containment: enough to keep the composition visible without
  // becoming the old center-collapse attractor.
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  obj.accX += (cx - obj.x) * gPhysics.centerBias;
  obj.accY += (cy - obj.y) * gPhysics.centerBias;
}

function ApplyCenterMass(obj) {
  if (!gPhysics.centerMassEnabled || !obj.hasGravityMass() || obj.isBeingDragged || obj.isFixed) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  let dx = cx - obj.x;
  let dy = cy - obj.y;
  let d = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / d;
  const ny = dy / d;
  const tx = -ny;
  const ty = nx;
  const radius = Math.max(48, gPhysics.centerMassRadius);
  const normalized = clamp(d / radius, 0, 4);

  // Pull from far away, repel inside the safety radius, and add a tangential
  // component so the center mass creates orbiting instead of collapse.
  const pull = gPhysics.g * gPhysics.centerMass * 0.055 * clamp(normalized - 0.35, 0, 1.8);
  const coreRepel = gPhysics.g * gPhysics.centerMass * 0.16 * Math.pow(clamp(1 - d / radius, 0, 1), 2);
  const orbit = gPhysics.g * gPhysics.centerMass * gPhysics.centerMassOrbit * 0.035 * clamp(1 - d / (radius * 4), 0, 1);
  const force = clamp(pull - coreRepel, -gPhysics.maxG, gPhysics.maxG);
  const orbitForce = clamp(orbit, -gPhysics.maxG * 0.5, gPhysics.maxG * 0.5);
  const invMass = 1 / Math.max(0.25, obj.mass);

  obj.accX += (nx * force + tx * orbitForce) * invMass;
  obj.accY += (ny * force + ty * orbitForce) * invMass;
  obj.interaction = Math.max(obj.interaction, clamp(1 - d / (radius * 4), 0, 1));
  obj.pairPull = Math.max(obj.pairPull, Math.max(0, force) / Math.max(1, gPhysics.maxG));
  obj.pairPush = Math.max(obj.pairPush, Math.max(0, -force) / Math.max(1, gPhysics.maxG));
  obj.orbitEnergy = Math.max(obj.orbitEnergy, Math.abs(orbitForce) / Math.max(1, gPhysics.maxG));
}

/*---------------------------------------------------------------------------*/
// Mouse interaction (with zoom/pan awareness)
function handleMouseDown(e) {
  const world = screenToWorld(e.clientX, e.clientY);
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  // Middle mouse or space+click = pan
  if (e.button === 1) {
    isPanning = true;
    canvas.style.cursor = 'move';
    e.preventDefault();
    return;
  }

  mouseIsDown = true;

  // Check for node at click position
  for (const obj of gGravityObjects) {
    if (obj.isActive() && obj.isPointInside(world.x, world.y, 8)) {
      SelectNode(obj.nodeId);
      draggedObject = obj;
      draggedObject.isBeingDragged = true;
      draggedObjectSavedMass = draggedObject.mass;
      draggedObject.mass = kDefaultObjectGravity * 4;
      canvas.style.cursor = 'grabbing';
      return;
    }
  }
}

function handleMouseUp(e) {
  if (isPanning) {
    isPanning = false;
    canvas.style.cursor = 'default';
    return;
  }

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
  const dxScreen = mouseX - lastMouseX;
  const dyScreen = mouseY - lastMouseY;

  if (isPanning) {
    gPanX += dxScreen;
    gPanY += dyScreen;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    return;
  }

  const world = screenToWorld(mouseX, mouseY);

  if (draggedObject) {
    // Move in world space
    const prevWorld = screenToWorld(lastMouseX, lastMouseY);
    draggedObject.x += (world.x - prevWorld.x);
    draggedObject.y += (world.y - prevWorld.y);
    canvas.style.cursor = 'grabbing';
  } else if (!mouseIsDown) {
    // Hover detection
    let hovering = false;
    for (const obj of gGravityObjects) {
      if (obj.isActive() && obj.isPointInside(world.x, world.y, 8)) {
        hovering = true;
        break;
      }
    }
    canvas.style.cursor = hovering ? 'grab' : 'default';
  }

  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function handleWheel(e) {
  e.preventDefault();
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(kMinZoom, Math.min(kMaxZoom, gZoom * zoomFactor));

  // Zoom toward mouse position
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const mx = e.clientX - cx - gPanX;
  const my = e.clientY - cy - gPanY;
  const scale = newZoom / gZoom;
  gPanX -= mx * (scale - 1);
  gPanY -= my * (scale - 1);

  gZoom = newZoom;
}

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('wheel', handleWheel, { passive: false });

// Prevent context menu on middle click
canvas.addEventListener('contextmenu', e => e.preventDefault());

/*---------------------------------------------------------------------------*/
// Node management
function normalizeNodePhysics(config = {}) {
  return {
    size: clamp(config.size ?? DEFAULT_NODE_PHYSICS.size, 14, 64),
    mass: clamp(config.mass ?? DEFAULT_NODE_PHYSICS.mass, 0.25, 6),
    gravity: clamp(config.gravityStrength ?? config.gravity ?? DEFAULT_NODE_PHYSICS.gravity, 0.1, 3),
    attraction: clamp(config.attraction ?? DEFAULT_NODE_PHYSICS.attraction, 0, 2),
    repulsion: clamp(config.repulsion ?? DEFAULT_NODE_PHYSICS.repulsion, 0, 2.5),
    orbit: clamp(config.orbit ?? DEFAULT_NODE_PHYSICS.orbit, -1.5, 1.5),
    influenceRadius: clamp(config.influenceRadius ?? DEFAULT_NODE_PHYSICS.influenceRadius, 80, 640),
  };
}

function FindOpenPosition(nodeIndex, size) {
  const count = Math.max(1, gGravityObjects.filter(o => o.alive).length);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxRadius = Math.max(140, Math.min(canvas.width, canvas.height) * 0.36);
  const baseRadius = Math.min(maxRadius, 150 + count * 22);
  const golden = M_PI * (3 - Math.sqrt(5));

  for (let attempt = 0; attempt < 36; attempt++) {
    const angle = (nodeIndex + attempt * 0.37) * golden;
    const radius = baseRadius * (0.72 + (attempt % 5) * 0.09);
    const candidate = {
      x: clamp(cx + Math.cos(angle) * radius + rand(-36, 36), size + 24, canvas.width - size - 24),
      y: clamp(cy + Math.sin(angle) * radius + rand(-36, 36), size + 24, canvas.height - size - 24),
    };
    const clear = gGravityObjects.every((obj) => !obj.alive || Math.hypot(obj.x - candidate.x, obj.y - candidate.y) > (obj.size + size + 54));
    if (clear) return candidate;
  }

  return { x: RandomWorldX(size + 90), y: RandomWorldY(size + 90) };
}

function SeedVelocity(obj) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const dx = obj.x - cx;
  const dy = obj.y - cy;
  const d = Math.max(1, Math.hypot(dx, dy));
  const tangent = (obj.nodeId % 2 === 0 ? 1 : -1);
  const speed = rand(28, 78) * Math.max(0.4, obj.physics.orbit + 0.8);
  obj.velX = (-dy / d) * speed * tangent + rand(-18, 18);
  obj.velY = (dx / d) * speed * tangent + rand(-18, 18);
}

function NewGravityNode(x, y, nodeIndex, nodeName, nodeRole, config = {}) {
  const physics = normalizeNodePhysics(config);
  const obj = new PhysicsObject(x, y, ColorForRole(nodeRole), physics.size);
  obj.nodeId = nodeIndex ?? gNextGravityNodeID++;
  obj.nodeName = nodeName || `Node ${obj.nodeId + 1}`;
  obj.nodeRole = nodeRole || 'muted';
  obj.physics = physics;
  obj.size = physics.size;
  obj.mass = kDefaultObjectGravity * physics.mass * physics.gravity;
  obj.isGravityObject = true;
  obj.hasTrail = true;
  obj.trailColor = ColorForRole(nodeRole);
  obj.isFixed = false;
  SeedVelocity(obj);
  return obj;
}

function AddNode(nodeIndex, nodeName, nodeRole, config = {}) {
  const existing = gGravityObjects.find(o => o.nodeId === nodeIndex && o.alive);
  if (existing) {
    SyncNodeConfig(nodeIndex, nodeName, nodeRole, config);
    SelectNode(nodeIndex);
    return existing.nodeId;
  }

  const physics = normalizeNodePhysics(config);
  const pos = FindOpenPosition(nodeIndex ?? gNextGravityNodeID, physics.size);
  const obj = NewGravityNode(pos.x, pos.y, nodeIndex, nodeName, nodeRole, config);
  gGravityObjects.push(obj);
  SelectNode(obj.nodeId);
  return obj.nodeId;
}

function SyncNodeConfig(nodeIndex, nodeName, nodeRole, config = {}) {
  for (const obj of gGravityObjects) {
    if (obj.nodeId === nodeIndex) {
      obj.nodeName = nodeName || `Node ${nodeIndex + 1}`;
      obj.nodeRole = nodeRole || 'muted';
      obj.color = ColorForRole(obj.nodeRole);
      obj.trailColor = ColorForRole(obj.nodeRole);
      obj.physics = normalizeNodePhysics({ ...obj.physics, ...config });
      obj.size = obj.physics.size;
      obj.mass = kDefaultObjectGravity * obj.physics.mass * obj.physics.gravity;
    }
  }
}

function RemoveNode(nodeIndex) {
  for (const obj of gGravityObjects) {
    if (obj.nodeId === nodeIndex) obj.alive = false;
  }
  gGravityObjects = gGravityObjects.filter(o => o.alive);
  gObjects = gObjects.filter(o => o.alive);
  if (gSelectedNodeId === nodeIndex) gSelectedNodeId = gGravityObjects[0]?.nodeId ?? null;
}

function ClearNodes() {
  for (const obj of gGravityObjects) obj.alive = false;
  gGravityObjects = [];
  gObjects = gObjects.filter(o => o.alive);
  gSelectedNodeId = null;
}

function SelectNode(nodeIndex) {
  const node = gGravityObjects.find(o => o.nodeId === nodeIndex && o.alive);
  gSelectedNodeId = node ? node.nodeId : (gGravityObjects[0]?.nodeId ?? null);
  window.dispatchEvent(new CustomEvent('glidepath:node-selected', { detail: { nodeIndex: gSelectedNodeId } }));
}

function SelectAdjacentNode(direction) {
  const ids = gGravityObjects.filter(o => o.alive).map(o => o.nodeId).sort((a, b) => a - b);
  if (!ids.length) return null;
  const current = ids.indexOf(gSelectedNodeId);
  const next = current < 0 ? 0 : (current + direction + ids.length) % ids.length;
  SelectNode(ids[next]);
  return ids[next];
}

function ApplyMovementPreset(name) {
  Object.assign(gPhysics, MOVEMENT_PRESETS[name] ?? MOVEMENT_PRESETS.orbital);
  RedistributeNodes(name);
}

function RedistributeNodes(mode = 'orbital') {
  const nodes = gGravityObjects.filter(o => o.alive).sort((a, b) => a.nodeId - b.nodeId);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radiusBase = Math.max(150, Math.min(canvas.width, canvas.height) * (mode === 'clustered' ? 0.18 : mode === 'scattered' ? 0.42 : 0.3));
  nodes.forEach((obj, index) => {
    const angle = (index / Math.max(1, nodes.length)) * M_2PI + rand(-0.18, 0.18);
    const spread = mode === 'chaotic' || mode === 'scattered' ? rand(0.72, 1.22) : rand(0.82, 1.08);
    obj.x = clamp(cx + Math.cos(angle) * radiusBase * spread, obj.size + 28, canvas.width - obj.size - 28);
    obj.y = clamp(cy + Math.sin(angle) * radiusBase * spread, obj.size + 28, canvas.height - obj.size - 28);
    SeedVelocity(obj);
    obj.trail = [];
  });
}

function RandomizeNodes(mode = 'orbital') {
  ApplyMovementPreset(mode);
  for (const obj of gGravityObjects) {
    const p = obj.physics;
    obj.physics = normalizeNodePhysics({
      ...p,
      size: rand(22, 44),
      mass: rand(0.55, mode === 'heavy' ? 4.2 : 2.2),
      gravity: rand(0.45, mode === 'chaotic' ? 2.4 : 1.5),
      attraction: rand(mode === 'scattered' ? 0.08 : 0.22, mode === 'clustered' ? 1.25 : 0.85),
      repulsion: rand(0.7, mode === 'scattered' ? 2.2 : 1.55),
      orbit: rand(mode === 'calm' ? 0.12 : -0.25, mode === 'chaotic' ? 1.15 : 0.75),
      influenceRadius: rand(180, mode === 'scattered' ? 520 : 360),
    });
    obj.size = obj.physics.size;
    obj.mass = kDefaultObjectGravity * obj.physics.mass * obj.physics.gravity;
    SeedVelocity(obj);
  }
}

function SetVisualPaused(paused) {
  gVisualPaused = !!paused;
}

function SetShowTrails(show) {
  gShowTrails = !!show;
}

function SetBorderMode(mode) {
  if (['repel', 'bounce', 'wrap', 'none'].includes(mode)) {
    gPhysics.borderMode = mode;
  }
}

function SetDamping(value) {
  gPhysics.damping = Math.max(0.9, Math.min(1.0, Number(value) || 0.998));
}

function SetGravity(value) {
  gPhysics.g = Math.max(10, Math.min(2000, Number(value) || 500));
}

function SetBorderMargin(value) {
  gPhysics.borderMargin = Math.max(10, Math.min(220, Number(value) || 80));
}

function SetCenterMassEnabled(enabled) {
  gPhysics.centerMassEnabled = !!enabled;
}

function SetCenterMass(value) {
  gPhysics.centerMass = clamp(Number(value) || 0, 0, 5);
}

function SetCenterMassRadius(value) {
  gPhysics.centerMassRadius = clamp(Number(value) || 96, 48, 260);
}

function SetCenterMassOrbit(value) {
  gPhysics.centerMassOrbit = clamp(Number(value) || 0, -1.5, 1.5);
}

function ResetView() {
  gZoom = 1.0;
  gPanX = 0;
  gPanY = 0;
}

// Expose API
window.GlidePathAddNode = AddNode;
window.GlidePathEnsureNode = AddNode;
window.GlidePathSyncNode = SyncNodeConfig;
window.GlidePathClearNodes = ClearNodes;
window.GlidePathRemoveNode = RemoveNode;
window.GlidePathSelectNode = SelectNode;
window.GlidePathSelectAdjacentNode = SelectAdjacentNode;
window.GlidePathApplyMovementPreset = ApplyMovementPreset;
window.GlidePathRandomizeNodes = RandomizeNodes;
window.GlidePathRedistributeNodes = RedistributeNodes;
window.GlidePathSetVisualPaused = SetVisualPaused;
window.GlidePathSetShowTrails = SetShowTrails;
window.GlidePathSetBorderMode = SetBorderMode;
window.GlidePathSetDamping = SetDamping;
window.GlidePathSetGravity = SetGravity;
window.GlidePathSetBorderMargin = SetBorderMargin;
window.GlidePathSetCenterMassEnabled = SetCenterMassEnabled;
window.GlidePathSetCenterMass = SetCenterMass;
window.GlidePathSetCenterMassRadius = SetCenterMassRadius;
window.GlidePathSetCenterMassOrbit = SetCenterMassOrbit;
window.GlidePathResetView = ResetView;

/*---------------------------------------------------------------------------*/
// Drawing helpers
function DrawBackground() {
  ctx.fillStyle = kBackgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid (zoom-aware)
  ctx.save();
  ctx.strokeStyle = kGridColor;
  ctx.lineWidth = 1;
  const baseGrid = 60;
  const gridSize = baseGrid * gZoom;
  const offsetX = (gPanX % gridSize + gridSize) % gridSize;
  const offsetY = (gPanY % gridSize + gridSize) % gridSize;

  for (let x = offsetX; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = offsetY; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Center crosshair (in world space)
  const center = worldToScreen(canvas.width / 2, canvas.height / 2);
  ctx.save();
  ctx.strokeStyle = kCenterMarkerColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(center.x - 30, center.y);
  ctx.lineTo(center.x + 30, center.y);
  ctx.moveTo(center.x, center.y - 30);
  ctx.lineTo(center.x, center.y + 30);
  ctx.stroke();
  ctx.restore();
}

function DrawBorders() {
  if (gPhysics.borderMode === 'none') return;

  const margin = gPhysics.borderMargin;
  const w = canvas.width;
  const h = canvas.height;

  ctx.save();

  if (gPhysics.borderMode === 'repel') {
    // Gradient edges showing repel zone
    const gradAlpha = 0.08;
    // Left
    const gLeft = ctx.createLinearGradient(0, 0, margin, 0);
    gLeft.addColorStop(0, `rgba(242,106,27,${gradAlpha * 2})`);
    gLeft.addColorStop(1, 'rgba(242,106,27,0)');
    ctx.fillStyle = gLeft;
    ctx.fillRect(0, 0, margin, h);
    // Right
    const gRight = ctx.createLinearGradient(w, 0, w - margin, 0);
    gRight.addColorStop(0, `rgba(242,106,27,${gradAlpha * 2})`);
    gRight.addColorStop(1, 'rgba(242,106,27,0)');
    ctx.fillStyle = gRight;
    ctx.fillRect(w - margin, 0, margin, h);
    // Top
    const gTop = ctx.createLinearGradient(0, 0, 0, margin);
    gTop.addColorStop(0, `rgba(242,106,27,${gradAlpha * 2})`);
    gTop.addColorStop(1, 'rgba(242,106,27,0)');
    ctx.fillStyle = gTop;
    ctx.fillRect(0, 0, w, margin);
    // Bottom
    const gBot = ctx.createLinearGradient(0, h, 0, h - margin);
    gBot.addColorStop(0, `rgba(242,106,27,${gradAlpha * 2})`);
    gBot.addColorStop(1, 'rgba(242,106,27,0)');
    ctx.fillStyle = gBot;
    ctx.fillRect(0, h - margin, w, margin);
  } else if (gPhysics.borderMode === 'bounce') {
    // Solid border lines
    ctx.strokeStyle = kBorderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  } else if (gPhysics.borderMode === 'wrap') {
    // Dashed border to indicate wrapping
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(96,165,250,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  }

  ctx.restore();
}

function DrawCenterMass() {
  if (!gPhysics.centerMassEnabled || gPhysics.centerMass <= 0) return;
  const center = worldToScreen(canvas.width / 2, canvas.height / 2);
  const radius = gPhysics.centerMassRadius * gZoom;

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = 'rgba(242,106,27,0.55)';
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, M_2PI);
  ctx.fill();

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = 'rgba(242,106,27,0.65)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, M_2PI);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(242,106,27,0.85)';
  ctx.fillStyle = 'rgba(242,106,27,0.9)';
  ctx.beginPath();
  ctx.arc(center.x, center.y, Math.max(6, 10 * gZoom), 0, M_2PI);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = `${Math.round(10 * gZoom)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CM', center.x, center.y - Math.max(18, 22 * gZoom));
  ctx.restore();
}

function DrawZoomIndicator() {
  if (gZoom === 1.0 && gPanX === 0 && gPanY === 0) return;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${Math.round(gZoom * 100)}%`, 10, canvas.height - 10);
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
  const deltaMS = Math.min(nowMS - gNowMS, 50); // Cap delta to prevent explosions after tab switch
  gNowMS = nowMS;
  const deltaS = gVisualPaused ? 0 : deltaMS / 1000;

  // Draw
  DrawBackground();
  DrawBorders();
  DrawCenterMass();
  DrawEmptyState();
  DrawZoomIndicator();

  // Physics: continuous object pair interactions
  const activeObjects = gGravityObjects.filter(o => o.isActive());
  ResetInteractionMetrics(activeObjects);
  const timeSeconds = gNowMS / 1000;
  for (const obj of activeObjects) {
    ApplyAmbientMotion(obj, timeSeconds);
    ApplyCenterMass(obj);
  }
  for (let i = 0; i < activeObjects.length - 1; i++) {
    for (let j = i + 1; j < activeObjects.length; j++) {
      ApplyNodeInteraction(activeObjects[i], activeObjects[j]);
    }
  }

  // Update and draw all objects
  for (const obj of gObjects) {
    if (!obj.isActive()) continue;
    obj.applyPhysics(deltaS);
    obj.resetAcceleration();
    obj.drawTrail();
    obj.draw();
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

    const nearest = Number.isFinite(o.nearestDistance) ? o.nearestDistance : nearestDist;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const acceleration = Math.sqrt(ax * ax + ay * ay);

    return {
      id: o.nodeId,
      index,
      name: o.nodeName,
      role: o.nodeRole,
      selected: o.nodeId === gSelectedNodeId,
      x: clamp(o.x / canvas.width, 0, 1),
      y: clamp(o.y / canvas.height, 0, 1),
      worldX: o.x,
      worldY: o.y,
      dist: clamp(dist / maxDist, 0, 1),
      nearest: clamp(nearest / maxDist, 0, 1),
      interaction: Math.max(clamp(1 - nearest / maxDist, 0, 1), clamp(o.interaction, 0, 1)),
      attraction: clamp(o.pairPull, 0, 1),
      repulsion: clamp(o.pairPush, 0, 1),
      orbit: clamp(o.orbitEnergy, 0, 1),
      angle: ((Math.atan2(dy, dx) * 180 / M_PI) + 360) % 360,
      speed: clamp(speed / 400, 0, 1.5),
      acceleration: clamp(acceleration / 1000, 0, 1.5),
      angularVelocity: clamp(angularVelocity, -1, 1),
      vx: clamp(vx / 400, -1.5, 1.5),
      vy: clamp(vy / 400, -1.5, 1.5),
      ax: clamp(ax / 1000, -1.5, 1.5),
      ay: clamp(ay / 1000, -1.5, 1.5),
      size: clamp(o.size / 64, 0, 1),
      mass: clamp((o.physics?.mass ?? 1) / 6, 0, 1),
      gravity: clamp((o.physics?.gravity ?? 1) / 3, 0, 1),
      influence: clamp((o.physics?.influenceRadius ?? 260) / 640, 0, 1),
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
    timeSeconds,
    selectedNode: gSelectedNodeId,
    zoom: gZoom,
    borderMode: gPhysics.borderMode,
    centerMass: {
      enabled: gPhysics.centerMassEnabled,
      mass: gPhysics.centerMass,
      radius: gPhysics.centerMassRadius,
      orbit: gPhysics.centerMassOrbit,
      x: 0.5,
      y: 0.5,
    },
    physics: { ...gPhysics },
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
