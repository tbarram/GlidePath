import WebRenderer from '@elemaudio/web-renderer';
import { el } from '@elemaudio/core';

let core = null;
let audioCtx = null;
let initialized = false;

// ─────────────────────────────────────────────────────────────────────
//  SCALES  (semitones from root A)
//  Angle around the ship is divided into equal arcs, one per scale note.
//  As an object orbits, it sweeps through the notes in order.
// ─────────────────────────────────────────────────────────────────────
const SCALES = {
  aminor:       [0, 2, 3, 5, 7, 8, 10],   // A B C D E F G
  aminorpenta:  [0, 3, 5, 7, 10],          // A C D E G
  amajor:       [0, 2, 4, 5, 7, 9, 11],   // A B C# D E F# G#
  adorian:      [0, 2, 3, 5, 7, 9, 10],   // A B C D E F# G
  dminor:       [2, 5, 3, 7, 9, 8, 0],    // D E F G A Bb C (root D, expressed from A)
};

function getScale(name) {
  return SCALES[name] ?? SCALES.aminor;
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Orbital position → discrete scale note
// angle (0–360°): which sector the object is in → which degree of the scale
// dist  (0–1):    register (close = low octave, far = high)
function angleToFreq(angleDeg, dist, baseOctave, scaleName) {
  const scale = getScale(scaleName);
  const degree = Math.floor(((angleDeg % 360) / 360) * scale.length) % scale.length;
  const octaveShift = dist < 0.25 ? -1 : dist > 0.65 ? 1 : 0;
  const rootMidi = 45 + (baseOctave - 2) * 12; // A2 at baseOctave 2
  return midiToHz(rootMidi + scale[degree] + octaveShift * 12);
}

// Amplitude envelope shape: bell curve, loudest at "orbital sweet spot"
function distToAmp(dist) {
  const peak = 0.28;
  const width = 0.22;
  return Math.min(1, Math.exp(-Math.pow(dist - peak, 2) / (2 * width * width)));
}

// How consonant are two objects based on angular separation?
// Returns 1 (perfect consonance) → 0 (dissonant)
function pairConsonance(a1, a2) {
  const diff = Math.abs((a1 - a2 + 360) % 360);
  const mirrored = diff > 180 ? 360 - diff : diff;
  const consonantCentres = [0, 102, 154, 180]; // unison, P5, m3, octave equivalents
  for (const c of consonantCentres) {
    if (Math.abs(mirrored - c) < 20) return 1;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────
//  ORBITAL SYNTHESIS  (always 8 fixed voices)
//
//  Each gravity object → one voice:
//    angle  → scale note (orbit = arpeggiation / chord voicing)
//    dist   → octave register + amplitude (bell curve)
//    speed  → vibrato depth & rate
//    angVel → flanger rate & depth  (drag trail = delay)
//
//  Global:
//    system energy     → master filter cutoff (chaos = bright)
//    pair consonance   → resonance & reverb mix
// ─────────────────────────────────────────────────────────────────────
const MAX_VOICES = 8;

// Flanger sizes in samples (~15ms ceiling at 44100 Hz)
const FLANGE_SIZE   = 2048;
const FLANGE_MIN_S  = 44;    // 1 ms
const FLANGE_MAX_S  = 441;   // 10 ms

function buildOrbitalGraph(state, params) {
  const { gravityObjects = [], systemEnergy = 0, objectCount = 0 } = state;

  const {
    masterVolume        = 0.55,
    baseOctave          = 2,
    scale               = 'aminor',
    detune              = 1.002,
    filterQ             = 0.8,
    reverbMix           = 0.38,
    flangeMix           = 0.55,
    vibratoDepth        = 0.010,
    proximityDistortion = 0.4,
    energyFilterScale   = 1.0,
  } = params;

  // ── System-level globals ───────────────────────────────────────────
  const energyCutoff = 300 + Math.min(1, systemEnergy * energyFilterScale) * 4200;

  let consonanceScore = 0;
  for (let i = 0; i < gravityObjects.length; i++)
    for (let j = i + 1; j < gravityObjects.length; j++)
      consonanceScore += pairConsonance(gravityObjects[i].angle, gravityObjects[j].angle);
  const maxPairs       = Math.max(1, (objectCount * (objectCount - 1)) / 2);
  const consonanceNorm = Math.min(1, consonanceScore / maxPairs);
  const resonance      = filterQ + (1 - consonanceNorm) * 2.5;
  const reverbAmt      = reverbMix * (0.5 + consonanceNorm * 0.5);

  // ── Build 8 voices ────────────────────────────────────────────────
  const voicesL = [];
  const voicesR = [];

  for (let i = 0; i < MAX_VOICES; i++) {
    const obj    = gravityObjects[i];
    const active = obj ? 1 : 0;
    const angle  = obj?.angle           ?? (i * 45);
    const dist   = obj?.dist            ?? 0.5;
    const speed  = obj?.speed           ?? 0;
    const angVel = obj?.angularVelocity ?? 0;

    const freq = angleToFreq(angle, dist, baseOctave, scale);
    const amp  = distToAmp(dist) * active;

    // ── Oscillator ──────────────────────────────────────────────────
    // Vibrato: depth scales with orbital speed, rate with angular velocity
    const vibRate  = 0.4 + Math.abs(angVel) * 8 + speed * 4;
    const vibDepth = speed * vibratoDepth;
    const vibLFO   = el.mul(
      el.const({ key: `vd_${i}`, value: freq * vibDepth }),
      el.cycle(el.const({ key: `vr_${i}`, value: vibRate }))
    );

    const fBase  = el.sm(el.const({ key: `f1_${i}`, value: freq }));
    const fDet   = el.sm(el.const({ key: `f2_${i}`, value: freq * detune }));
    const fMod1  = el.add(fBase, vibLFO);
    const fMod2  = el.add(fDet,  vibLFO);

    const osc = el.add(
      el.mul(el.cycle(fMod1), el.const({ key: `og1_${i}`, value: 0.55 })),
      el.mul(el.cycle(fMod2), el.const({ key: `og2_${i}`, value: 0.45 }))
    );

    // Sub-octave for objects near the ship (weight / gravity pull)
    const subAmp = active * Math.max(0, 1 - dist / 0.3) * proximityDistortion;
    const sub    = el.mul(
      el.cycle(el.sm(el.const({ key: `sf_${i}`, value: freq * 0.5 }))),
      el.const({ key: `sg_${i}`, value: subAmp * 0.3 })
    );

    const dryVoice = el.add(osc, sub);

    // ── Flanger: drag trail = delay ──────────────────────────────────
    // The trail's length ≈ speed, curvature ≈ |angVel|
    // flangeRate: how fast the delay sweeps (tighter orbit = faster sweep)
    // flangeDepth: how much the delay modulates (faster object = deeper flange)
    const fRate  = 0.3 + Math.abs(angVel) * 6 + speed * 2;
    const fDepth = (FLANGE_MAX_S - FLANGE_MIN_S) * 0.5 * Math.min(1, speed * 2 + Math.abs(angVel));
    const fBase_s = FLANGE_MIN_S + (FLANGE_MAX_S - FLANGE_MIN_S) * 0.4;

    // Flange LFO sweeps the delay time
    const flangeLFO = el.mul(
      el.const({ key: `fldepth_${i}`, value: fDepth }),
      el.cycle(el.const({ key: `flrate_${i}`,  value: fRate }))
    );
    const delayTime = el.add(
      el.const({ key: `flbase_${i}`, value: fBase_s }),
      flangeLFO
    );

    // Comb filter: dry + delayed copy with feedback
    const flanged   = el.delay({ size: FLANGE_SIZE }, delayTime, 0.45, dryVoice);
    const fMixGain  = el.const({ key: `flmix_${i}`, value: flangeMix * active });
    const voice     = el.add(
      el.mul(dryVoice, el.const({ key: `drymix_${i}`, value: 1 - flangeMix * 0.5 * active })),
      el.mul(flanged,  fMixGain)
    );

    // ── Equal-power pan from angle ───────────────────────────────────
    const panAngle = (angle * Math.PI) / 180;
    const panL     = Math.cos(panAngle * 0.5 + Math.PI / 4);
    const panR     = Math.sin(panAngle * 0.5 + Math.PI / 4);
    const gainVal  = amp / Math.max(1, MAX_VOICES * 0.4);

    voicesL.push(el.mul(voice, el.sm(el.const({ key: `gL_${i}`, value: gainVal * panL }))));
    voicesR.push(el.mul(voice, el.sm(el.const({ key: `gR_${i}`, value: gainVal * panR }))));
  }

  // ── Sum & master processing ────────────────────────────────────────
  const sumL = voicesL.reduce((a, b) => el.add(a, b));
  const sumR = voicesR.reduce((a, b) => el.add(a, b));

  const fc    = el.sm(el.const({ key: 'sys_fc', value: energyCutoff }));
  const q     = el.sm(el.const({ key: 'sys_q',  value: resonance }));
  const filtL = el.lowpass(fc, q, sumL);
  const filtR = el.lowpass(fc, q, sumR);

  const rvMix = el.sm(el.const({ key: 'rv_mix', value: reverbAmt }));
  const revL  = el.mul(el.delay({ size: 44200 }, el.const({ key: 'rv_d1', value: 16537 }), 0.38, filtL), rvMix);
  const revR  = el.mul(el.delay({ size: 44200 }, el.const({ key: 'rv_d2', value: 23400 }), 0.34, filtR), rvMix);

  const outL = el.add(filtL, revL);
  const outR = el.add(filtR, revR);
  const vol  = el.sm(el.const({ key: 'master_vol', value: masterVolume }));

  return [el.mul(outL, vol), el.mul(outR, vol)];
}

// ─────────────────────────────────────────────────────────────────────
export async function initAudio() {
  if (initialized) { audioCtx?.resume(); return; }
  audioCtx = new AudioContext();
  core     = new WebRenderer();
  const node = await core.initialize(audioCtx, {
    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
  });
  node.connect(audioCtx.destination);
  initialized = true;
}

export function renderAudio(state, params) {
  if (!initialized || !core || audioCtx?.state !== 'running') return;
  try {
    const [L, R] = buildOrbitalGraph(state, params);
    core.render(L, R);
  } catch (e) {
    console.warn('[GlidePath Synth]', e.message);
  }
}

export function suspendAudio()    { audioCtx?.suspend(); }
export function resumeAudio()     { audioCtx?.resume(); }
export function isInitialized()   { return initialized; }
