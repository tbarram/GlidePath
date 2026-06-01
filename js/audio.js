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
  aminor:      [0, 2, 3, 5, 7, 8, 10],   // A B C D E F G
  aminorpenta: [0, 3, 5, 7, 10],          // A C D E G
  amajor:      [0, 2, 4, 5, 7, 9, 11],   // A B C# D E F# G#
  adorian:     [0, 2, 3, 5, 7, 9, 10],   // A B C D E F# G
  dminor:      [2, 5, 3, 7, 9, 8, 0],    // D E F G A Bb C (root D, expressed from A)
};

function getScale(name) { return SCALES[name] ?? SCALES.aminor; }

function midiToHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

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
  const peak = 0.28, width = 0.22;
  return Math.min(1, Math.exp(-Math.pow(dist - peak, 2) / (2 * width * width)));
}

// How consonant are two objects based on angular separation?
// Returns 1 (perfect consonance) → 0 (dissonant)
function pairConsonance(a1, a2) {
  const diff     = Math.abs((a1 - a2 + 360) % 360);
  const mirrored = diff > 180 ? 360 - diff : diff;
  const consonantCentres = [0, 102, 154, 180]; // unison, P5, m3, octave equivalents
  return consonantCentres.some(c => Math.abs(mirrored - c) < 20) ? 1 : 0;
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
const MAX_VOICES   = 8;

// Flanger sizes in samples (~15ms ceiling at 44100 Hz)
const FLANGE_SIZE  = 2048;
const FLANGE_MIN_S = 44;    // 1 ms
const FLANGE_MAX_S = 441;   // 10 ms
const VS_SIZE      = 1024;  // varispeed delay buffer

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
    // Stutter / varispeed
    stutterRate         = 0,    // Hz — 0 = off
    stutterDepth        = 0,    // 0–1 gate depth
    varispeedAmount     = 0,    // 0–1 pitch-sweep depth
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
    const vibRate = 0.4 + Math.abs(angVel) * 8 + speed * 4;
    const vibLFO  = el.mul(
      el.const({ key: `vd_${i}`, value: freq * speed * vibratoDepth }),
      el.cycle(el.const({ key: `vr_${i}`, value: vibRate }))
    );
    const fMod1 = el.add(el.sm(el.const({ key: `f1_${i}`, value: freq })),          vibLFO);
    const fMod2 = el.add(el.sm(el.const({ key: `f2_${i}`, value: freq * detune })), vibLFO);

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

    let voice = el.add(osc, sub);

    // ── Flanger: drag trail = delay ──────────────────────────────────
    // The trail's length ≈ speed, curvature ≈ |angVel|
    // flangeRate: how fast the delay sweeps (tighter orbit = faster sweep)
    // flangeDepth: how much the delay modulates (faster object = deeper flange)
    const fRate  = 0.3 + Math.abs(angVel) * 6 + speed * 2;
    const fDepth = (FLANGE_MAX_S - FLANGE_MIN_S) * 0.5
                   * Math.min(1, speed * 2 + Math.abs(angVel));

    // Flange LFO sweeps the delay time
    const flangeLFO  = el.mul(
      el.const({ key: `fld_${i}`, value: fDepth }),
      el.cycle(el.const({ key: `flr_${i}`, value: fRate }))
    );
    const flangeTime = el.add(
      el.const({ key: `flb_${i}`, value: FLANGE_MIN_S + (FLANGE_MAX_S - FLANGE_MIN_S) * 0.4 }),
      flangeLFO
    );

    // Comb filter: dry + delayed copy with feedback
    const flanged     = el.delay({ size: FLANGE_SIZE }, flangeTime, 0.45, voice);
    const flangedVoice = el.add(
      el.mul(voice,   el.const({ key: `fldrymx_${i}`, value: 1 - flangeMix * 0.5 * active })),
      el.mul(flanged, el.const({ key: `flwetmx_${i}`, value: flangeMix * active }))
    );
    voice = flangedVoice;

    // ── Varispeed + Stutter ─────────────────────────────────────────
    // Both are on always; when depth = 0 the math collapses to pass-through.

    // VARISPEED: rising phasor sweeps delay time → pitch lowers then snaps back up
    // Sweep depth scales with varispeedAmount (0 = no delay mod → no pitch change)
    const vsDepthSamples = varispeedAmount * 320;
    const vsRate         = Math.max(0.01, stutterRate * 0.5);
    const vsLFO          = el.mul(
      el.const({ key: `vsd_${i}`, value: vsDepthSamples }),
      el.phasor(el.const({ key: `vsr_${i}`, value: vsRate }))
    );
    const vsDelayTime = el.add(
      el.const({ key: `vsb_${i}`, value: 10 }),
      vsLFO
    );
    const vsWet   = el.delay({ size: VS_SIZE }, vsDelayTime, 0.0, voice);
    const vsBlend = el.const({ key: `vsamt_${i}`, value: varispeedAmount * 0.6 });
    voice = el.add(
      el.mul(voice, el.sub(el.const({ key: `vsdry_${i}`, value: 1 }), vsBlend)),
      el.mul(vsWet, vsBlend)
    );

    // STUTTER GATE: tanh-sharpened sine → near-square wave at stutterRate
    // sharpness 0 = sine (no stuttering); sharpness 10 = near-square (hard stutter)
    // gate = lerp(1, squareWave, stutterDepth) so depth=0 is fully transparent
    const sharpness  = stutterDepth * 10;
    const squareWave = el.mul(
      el.const({ key: `stsc_${i}`, value: 0.5 }),
      el.add(
        el.const({ key: `stbs_${i}`, value: 1 }),
        el.tanh(el.mul(
          el.cycle(el.const({ key: `strt_${i}`, value: Math.max(0.01, stutterRate) })),
          el.const({ key: `stsh_${i}`, value: sharpness })
        ))
      )
    );
    // gate: fully open (1) when stutterDepth=0; oscillates 0→1 when stutterDepth=1
    const gate = el.add(
      el.const({ key: `stdry_${i}`, value: 1 - stutterDepth }),
      el.mul(squareWave, el.const({ key: `stwet_${i}`, value: stutterDepth }))
    );
    voice = el.mul(voice, gate);

    // ── Equal-power pan from angle ───────────────────────────────────
    const panAngle = (angle * Math.PI) / 180;
    const panL     = Math.cos(panAngle * 0.5 + Math.PI / 4);
    const panR     = Math.sin(panAngle * 0.5 + Math.PI / 4);
    const gainVal  = amp / Math.max(1, MAX_VOICES * 0.4);

    voicesL.push(el.mul(voice, el.sm(el.const({ key: `gL_${i}`, value: gainVal * panL }))));
    voicesR.push(el.mul(voice, el.sm(el.const({ key: `gR_${i}`, value: gainVal * panR }))));
  }

  // ── Sum & master processing ────────────────────────────────────────
  const sumL  = voicesL.reduce((a, b) => el.add(a, b));
  const sumR  = voicesR.reduce((a, b) => el.add(a, b));
  const fc    = el.sm(el.const({ key: 'sys_fc', value: energyCutoff }));
  const q     = el.sm(el.const({ key: 'sys_q',  value: resonance }));
  const filtL = el.lowpass(fc, q, sumL);
  const filtR = el.lowpass(fc, q, sumR);

  const rvMix = el.sm(el.const({ key: 'rv_mix', value: reverbAmt }));
  const revL  = el.mul(el.delay({ size: 44200 }, el.const({ key: 'rv_d1', value: 16537 }), 0.38, filtL), rvMix);
  const revR  = el.mul(el.delay({ size: 44200 }, el.const({ key: 'rv_d2', value: 23400 }), 0.34, filtR), rvMix);

  const vol = el.sm(el.const({ key: 'master_vol', value: masterVolume }));
  return [
    el.mul(el.add(filtL, revL), vol),
    el.mul(el.add(filtR, revR), vol),
  ];
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

export function suspendAudio()  { audioCtx?.suspend(); }
export function resumeAudio()   { audioCtx?.resume(); }
export function isInitialized() { return initialized; }
