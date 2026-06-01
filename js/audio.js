const MAX_AUDIO_NODES = 12;

const SCALES = {
  aminor: [0, 2, 3, 5, 7, 8, 10],
  aminorpenta: [0, 3, 5, 7, 10],
  amajor: [0, 2, 4, 5, 7, 9, 11],
  adorian: [0, 2, 3, 5, 7, 9, 10],
  dminor: [2, 5, 3, 7, 8, 10],
};

const DEFAULT_NODE = {
  role: 'muted',
  enabled: true,
};

let engine = null;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function motionValue(obj, state, movement = 'distance') {
  if (!obj) return 0;
  switch (movement) {
    case 'x': return clamp(obj.x ?? 0);
    case 'y': return clamp(obj.y ?? 0);
    case 'distance': return clamp(obj.dist ?? 0);
    case 'interaction': return clamp(obj.interaction ?? 0);
    case 'attraction': return clamp(obj.attraction ?? 0);
    case 'repulsion': return clamp(obj.repulsion ?? 0);
    case 'orbit': return clamp(obj.orbit ?? 0);
    case 'near': return 1 - clamp(obj.dist ?? 0);
    case 'nearest': return 1 - clamp(obj.nearest ?? obj.dist ?? 0);
    case 'speed': return clamp(obj.speed ?? 0);
    case 'acceleration': return clamp(obj.acceleration ?? 0);
    case 'angle': return clamp((obj.angle ?? 0) / 360);
    case 'angularVelocity': return clamp(Math.abs(obj.angularVelocity ?? 0));
    case 'energy': return clamp(state.systemEnergy ?? 0);
    case 'time': {
      // Continuous time oscillation — useful as an LFO-like motion source
      const t = state.timeSeconds ?? 0;
      return (Math.sin(t * M_PI * 2 * 0.1) + 1) * 0.5;
    }
    default: return clamp(obj.dist ?? 0);
  }
}

const M_PI = Math.PI;

function behaviorValue(obj, state, config) {
  const behavior = config.behavior ?? 'spatial';
  const movement = config.motionParam ?? 'angle';
  const spatial = motionValue(obj, state, movement);
  const timeRate = config.timeRate ?? 0.2;
  const time = (Math.sin((state.timeSeconds ?? 0) * timeRate * M_PI * 2) + 1) * 0.5;
  // Pseudo-random based on time + node id — gives repeatable but organic variation
  const random = (Math.sin((state.timeSeconds ?? 0) * 7.13 + (obj?.id ?? 0) * 11.7) + 1) * 0.5;

  if (behavior === 'static') return 0.5;
  if (behavior === 'time') return time;
  if (behavior === 'random') return random;
  if (behavior === 'spatial-time') return spatial * 0.6 + time * 0.4;
  return spatial;
}

function targetMatches(target, sourceIndex) {
  return target === 'mix' || target === 'sources' || target === `node-${sourceIndex}`;
}

function normalizeNode(config) {
  return { ...DEFAULT_NODE, ...(config ?? {}) };
}

function createNoiseBuffer(ctx) {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function createImpulse(ctx, seconds = 2.4, decay = 2.8) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function encodeWav(chunks, sampleRate) {
  const channelCount = 2;
  const totalFrames = chunks.reduce((sum, chunk) => sum + chunk[0].length, 0);
  const byteLength = 44 + totalFrames * channelCount * 2;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset++, value.charCodeAt(i));
  };
  const writeUint32 = (value) => { view.setUint32(offset, value, true); offset += 4; };
  const writeUint16 = (value) => { view.setUint16(offset, value, true); offset += 2; };

  writeString('RIFF');
  writeUint32(byteLength - 8);
  writeString('WAVE');
  writeString('fmt ');
  writeUint32(16);
  writeUint16(1);
  writeUint16(channelCount);
  writeUint32(sampleRate);
  writeUint32(sampleRate * channelCount * 2);
  writeUint16(channelCount * 2);
  writeUint16(16);
  writeString('data');
  writeUint32(totalFrames * channelCount * 2);

  for (const chunk of chunks) {
    const left = chunk[0];
    const right = chunk[1] ?? left;
    for (let i = 0; i < left.length; i++) {
      view.setInt16(offset, clamp(left[i], -1, 1) * 0x7fff, true);
      offset += 2;
      view.setInt16(offset, clamp(right[i], -1, 1) * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

class SourceVoice {
  constructor(engineRef, index) {
    this.engine = engineRef;
    this.index = index;
    this.signature = '';
    this.output = null;
    this.gain = null;
    this.pan = null;
    this.highpass = null;
    this.filter = null;
    this.source = null;
    this.sourceKind = '';
    this.send = {};
  }

  dispose() {
    try { this.source?.stop(); } catch {}
    try { this.source?.disconnect(); } catch {}
    try { this.output?.disconnect(); } catch {}
    this.source = null;
    this.sourceKind = '';
    this.highpass = null;
    this.filter = null;
    this.gain = null;
    this.pan = null;
    this.output = null;
    this.signature = '';
  }

  ensure(config) {
    const sourceType = config.sourceType ?? 'scale';
    const sample = this.engine.samples.get(this.index);
    const sampleVersion = sample?.version ?? 0;
    const signature = `${sourceType}:${config.waveform ?? 'sine'}:${sampleVersion}`;
    if (signature === this.signature) return;

    this.dispose();

    const ctx = this.engine.ctx;
    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 55;
    this.highpass.Q.value = 0.6;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = config.filterCutoff ?? 8000;
    this.filter.Q.value = 0.75;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.pan = ctx.createStereoPanner();
    this.pan.pan.value = 0;
    this.output = this.pan;

    this.highpass.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.pan);
    this.pan.connect(this.engine.dryBus);

    for (const name of ['echo', 'reverb', 'flanger']) {
      const sendGain = ctx.createGain();
      sendGain.gain.value = 0;
      this.pan.connect(sendGain);
      sendGain.connect(this.engine[`${name}Input`]);
      this.send[name] = sendGain;
    }

    if (sourceType === 'noise') {
      this.source = ctx.createBufferSource();
      this.source.buffer = this.engine.noiseBuffer;
      this.source.loop = true;
      this.sourceKind = 'buffer';
    } else if (sourceType === 'file' && sample?.buffer) {
      this.source = ctx.createBufferSource();
      this.source.buffer = sample.buffer;
      this.source.loop = true;
      this.source.playbackRate.value = 1;
      this.sourceKind = 'buffer';
    } else {
      this.source = ctx.createOscillator();
      this.source.type = config.waveform ?? 'sine';
      this.source.frequency.value = midiToHz(config.midiNote ?? 57);
      this.sourceKind = 'oscillator';
    }

    this.source.connect(this.highpass);
    this.source.start();
    this.signature = signature;
  }

  update(obj, state, params, config, modulators, effects, mixInfo = {}) {
    this.ensure(config);

    const ctx = this.engine.ctx;
    const now = ctx.currentTime;
    const sourceType = config.sourceType ?? 'scale';
    const activeSources = Math.max(1, mixInfo.activeSources ?? 1);
    const headroom = 0.88 / Math.sqrt(activeSources);
    const baseGain = (config.gain ?? 0.45) * (params.masterVolume ?? 0.62) * headroom;
    const motion = behaviorValue(obj, state, config);
    const envAmp = clamp(0.72 + modulators.amp, 0.08, 1.45);

    // Use separate smoothing for pitch (faster) vs gain (slower to avoid clicks)
    const gainSmooth = Math.max(0.02, modulators.time);
    const pitchSmooth = Math.max(0.01, modulators.time * 0.5);

    let frequency = midiToHz(config.midiNote ?? 57);
    if (sourceType === 'scale') {
      const scale = SCALES[config.scale ?? params.globalScale ?? 'aminor'] ?? SCALES.aminor;
      const degree = Math.floor(motion * scale.length) % scale.length;
      const octaveShift = motion < 0.25 ? -1 : motion > 0.75 ? 1 : 0;
      const rootMidi = 45 + ((config.baseOctave ?? params.baseOctave ?? 4) - 2) * 12;
      frequency = midiToHz(rootMidi + scale[degree] + octaveShift * 12);
    } else if (sourceType === 'note') {
      frequency = midiToHz((config.midiNote ?? 57) + (motion - 0.5) * (config.pitchDepth ?? 0));
    }

    // Apply pitch modulation
    const pitchMod = clamp(1 + modulators.pitch, 0.5, 2);
    if (this.sourceKind === 'oscillator') {
      this.source.frequency.setTargetAtTime(frequency * pitchMod, now, pitchSmooth);
    } else if (sourceType === 'file' && this.source?.playbackRate) {
      this.source.playbackRate.setTargetAtTime(clamp(pitchMod * 2 - 1, 0.25, 4), now, pitchSmooth);
    }

    // Gain — clamp to prevent distortion, use longer smoothing to avoid clicks
    const sourceAmp = sourceType === 'noise' ? 0.38 : sourceType === 'file' ? 0.72 : 1;
    const transientLift = sourceType === 'noise' ? clamp((obj?.acceleration ?? 0) * 0.32, 0, 0.32) : 0;
    const gain = config.enabled === false ? 0 : clamp(baseGain * sourceAmp * (envAmp + transientLift), 0, 0.82);
    this.gain.gain.setTargetAtTime(gain, now, gainSmooth);

    // Spatial panning
    const stereoSpread = activeSources > 1 ? (((this.index % activeSources) / Math.max(1, activeSources - 1)) - 0.5) * 0.45 : 0;
    const pan = config.spacePan === false
      ? (config.staticPan ?? 0)
      : clamp(((obj?.x ?? 0.5) - 0.5) * 1.65 + stereoSpread + modulators.pan * 0.55, -1, 1);
    this.pan.pan.setTargetAtTime(pan, now, 0.03);

    // Filter with modulation
    const registerHighpass = sourceType === 'noise'
      ? 180 + this.index * 22
      : Math.max(35, 48 * Math.pow(1.22, this.index % 6));
    this.highpass.frequency.setTargetAtTime(registerHighpass, now, 0.05);

    const antiMaskTilt = 1 + (this.index % 4) * 0.08 + (obj?.interaction ?? 0) * 0.18;
    const cutoff = clamp((config.filterCutoff ?? 8000) * (1 + modulators.filter * 0.75) * antiMaskTilt, 140, 17500);
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.035);

    // Effect sends
    for (const name of ['echo', 'reverb', 'flanger']) {
      const sendLimit = name === 'reverb' ? 0.62 : name === 'echo' ? 0.48 : 0.42;
      this.send[name].gain.setTargetAtTime(clamp(effects[name] ?? 0, 0, sendLimit), now, 0.045);
    }
  }
}

class AudioDesignEngine {
  constructor() {
    this.ctx = null;
    this.destination = null;
    this.master = null;
    this.voices = new Map();
    this.samples = new Map();
    this.sampleVersion = 0;
    this.noiseBuffer = null;
    this.recording = false;
    this.recordedChunks = [];
  }

  async init() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }

    this.ctx = new AudioContext();
    this.noiseBuffer = createNoiseBuffer(this.ctx);

    this.dryBus = this.ctx.createGain();
    this.preFilter = this.ctx.createGain();
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 18;
    this.compressor.attack.value = 0.012;
    this.compressor.release.value = 0.18;
    this.compressor.ratio.value = 2.4;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.74;

    this.echoInput = this.ctx.createGain();
    this.echoDelay = this.ctx.createDelay(2);
    this.echoFeedback = this.ctx.createGain();
    this.echoReturn = this.ctx.createGain();
    this.echoDelay.delayTime.value = 0.22;
    this.echoFeedback.gain.value = 0.24;
    this.echoReturn.gain.value = 0.55;
    this.echoInput.connect(this.echoDelay);
    this.echoDelay.connect(this.echoFeedback);
    this.echoFeedback.connect(this.echoDelay);
    this.echoDelay.connect(this.echoReturn);

    this.reverbInput = this.ctx.createGain();
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = createImpulse(this.ctx);
    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 0.5;
    this.reverbInput.connect(this.reverb);
    this.reverb.connect(this.reverbReturn);

    this.flangerInput = this.ctx.createGain();
    this.flangerDelay = this.ctx.createDelay(0.03);
    this.flangerReturn = this.ctx.createGain();
    this.flangerFeedback = this.ctx.createGain();
    this.flangerLfo = this.ctx.createOscillator();
    this.flangerDepth = this.ctx.createGain();
    this.flangerDelay.delayTime.value = 0.006;
    this.flangerFeedback.gain.value = 0.16;
    this.flangerReturn.gain.value = 0.42;
    this.flangerLfo.frequency.value = 0.25;
    this.flangerDepth.gain.value = 0.002;
    this.flangerInput.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerFeedback);
    this.flangerFeedback.connect(this.flangerDelay);
    this.flangerDelay.connect(this.flangerReturn);
    this.flangerLfo.connect(this.flangerDepth);
    this.flangerDepth.connect(this.flangerDelay.delayTime);
    this.flangerLfo.start();

    this.dryBus.connect(this.preFilter);
    this.echoReturn.connect(this.preFilter);
    this.reverbReturn.connect(this.preFilter);
    this.flangerReturn.connect(this.preFilter);
    this.preFilter.connect(this.filter);
    this.filter.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(this.ctx.destination);

    try {
      await this.ctx.audioWorklet.addModule(new URL('./recording-worklet.js', import.meta.url));
      this.recorder = new AudioWorkletNode(this.ctx, 'wav-recorder', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      const silent = this.ctx.createGain();
      silent.gain.value = 0;
      this.master.connect(this.recorder);
      this.recorder.connect(silent);
      silent.connect(this.ctx.destination);
      this.recorder.port.onmessage = ({ data }) => {
        if (data?.type === 'chunk') this.recordedChunks.push(data.channels);
      };
    } catch (error) {
      console.warn('[GlidePath Recorder]', error.message);
    }
  }

  sync(state, params) {
    if (!this.ctx || this.ctx.state !== 'running') return;

    const nodes = params.nodes ?? [];
    const objects = state.gravityObjects ?? [];
    const objectById = new Map(objects.map((obj) => [obj.id, obj]));
    const now = this.ctx.currentTime;
    const sourceEffects = new Map();
    const sourceMods = new Map();
    const activeSourceCount = nodes.filter((node, index) => {
      const config = normalizeNode(node);
      return config.role === 'source' && config.enabled !== false && (objectById.has(index) || objects[index]);
    }).length;
    const mixEffects = {
      echo: 0,
      reverb: 0,
      flanger: 0,
      cutoff: 18000,
      compression: 0.08,
      echoTime: 0.22,
      echoFeedback: 0.24,
      flangerRate: 0.25,
      flangerDepth: 0.002,
    };

    for (let i = 0; i < MAX_AUDIO_NODES; i++) {
      sourceEffects.set(i, { echo: 0, reverb: 0, flanger: 0 });
      sourceMods.set(i, { amp: 0, pitch: 0, filter: 0, pan: 0, time: 0.04 });
    }

    for (let i = 0; i < MAX_AUDIO_NODES; i++) {
      const config = normalizeNode(nodes[i]);
      const obj = objectById.get(i) ?? objects[i];
      if (!config.enabled || !obj) continue;
      const value = motionValue(obj, state, config.movement);
      const shaped = config.polarity === 'inverse' ? 1 - value : value;
      const amount = (config.amount ?? 0.5) * shaped;

      if (config.role === 'envelope') {
        for (let targetIndex = 0; targetIndex < MAX_AUDIO_NODES; targetIndex++) {
          if (!targetMatches(config.target ?? 'sources', targetIndex)) continue;
          const mod = sourceMods.get(targetIndex);
          if (config.destination === 'pitch') mod.pitch += (amount - 0.25) * 0.055;
          else if (config.destination === 'filter') mod.filter += amount * 1.15;
          else if (config.destination === 'pan') mod.pan += (amount - 0.25) * 1.35;
          else mod.amp += amount * 0.75;
          mod.time = Math.max(0.01, shaped > 0.5 ? (config.attack ?? 0.04) : (config.release ?? 0.2));
        }
      }

      if (config.role === 'effect') {
        const effectType = config.effectType ?? 'reverb';
        const baseMix = config.baseMix ?? 0.2;
        const wet = clamp(baseMix + amount);
        if ((config.target ?? 'mix') === 'mix') {
          if (effectType === 'echo') {
            mixEffects.echo = Math.max(mixEffects.echo, wet);
            mixEffects.echoTime = clamp(config.time ?? 0.25, 0.03, 1.5);
            mixEffects.echoFeedback = clamp((config.feedback ?? 0.28) + shaped * 0.25, 0, 0.72);
          } else if (effectType === 'flanger') {
            mixEffects.flanger = Math.max(mixEffects.flanger, wet);
            mixEffects.flangerRate = clamp(0.1 + shaped * 5, 0.05, 8);
            mixEffects.flangerDepth = clamp(0.001 + shaped * 0.006, 0.0005, 0.012);
          } else if (effectType === 'filter') {
            mixEffects.cutoff = Math.min(mixEffects.cutoff, 180 + shaped * 9000);
          } else if (effectType === 'compressor') {
            mixEffects.compression = Math.max(mixEffects.compression, wet);
          } else {
            mixEffects.reverb = Math.max(mixEffects.reverb, wet);
          }
        } else {
          for (let targetIndex = 0; targetIndex < MAX_AUDIO_NODES; targetIndex++) {
            if (!targetMatches(config.target ?? 'sources', targetIndex)) continue;
            const fx = sourceEffects.get(targetIndex);
            if (effectType === 'echo') fx.echo = Math.max(fx.echo, wet);
            else if (effectType === 'flanger') fx.flanger = Math.max(fx.flanger, wet);
            else if (effectType === 'reverb') fx.reverb = Math.max(fx.reverb, wet);
          }
        }
      }
    }

    const densityDuck = clamp(1 - Math.max(0, activeSourceCount - 2) * 0.06, 0.62, 1);
    this.echoReturn.gain.setTargetAtTime(0.52 * densityDuck, now, 0.05);
    this.reverbReturn.gain.setTargetAtTime(0.48 * densityDuck, now, 0.05);
    this.flangerReturn.gain.setTargetAtTime(0.4 * densityDuck, now, 0.05);
    this.echoDelay.delayTime.setTargetAtTime(mixEffects.echoTime, now, 0.05);
    this.echoFeedback.gain.setTargetAtTime(mixEffects.echoFeedback, now, 0.05);
    this.flangerLfo.frequency.setTargetAtTime(mixEffects.flangerRate, now, 0.05);
    this.flangerDepth.gain.setTargetAtTime(mixEffects.flangerDepth, now, 0.05);
    const energyBrightness = clamp((state.systemEnergy ?? 0) * 2400, 0, 2400);
    this.filter.frequency.setTargetAtTime(clamp(mixEffects.cutoff + energyBrightness, 320, 17500), now, 0.05);
    this.compressor.threshold.setTargetAtTime(-14 - mixEffects.compression * 20, now, 0.05);
    this.compressor.ratio.setTargetAtTime(2.2 + mixEffects.compression * 6, now, 0.05);
    this.master.gain.setTargetAtTime((params.outputGain ?? 0.78) * densityDuck, now, 0.04);

    for (let i = 0; i < MAX_AUDIO_NODES; i++) {
      const config = normalizeNode(nodes[i]);
      const obj = objectById.get(i) ?? objects[i];
      const isSource = config.role === 'source' && config.enabled !== false && obj;
      if (!isSource) {
        this.voices.get(i)?.dispose();
        this.voices.delete(i);
        continue;
      }

      if (!this.voices.has(i)) this.voices.set(i, new SourceVoice(this, i));
      const nodeEffects = sourceEffects.get(i);
      this.voices.get(i).update(
        obj,
        state,
        params,
        config,
        sourceMods.get(i),
        {
          echo: Math.max(nodeEffects.echo, mixEffects.echo),
          reverb: Math.max(nodeEffects.reverb, mixEffects.reverb),
          flanger: Math.max(nodeEffects.flanger, mixEffects.flanger),
        },
        { activeSources: activeSourceCount }
      );
    }
  }

  async loadSample(index, file) {
    await this.init();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.samples.set(index, {
      buffer,
      name: file.name,
      version: ++this.sampleVersion,
    });
  }

  startRecording() {
    if (!this.recorder) throw new Error('Recorder worklet is not available');
    this.recordedChunks = [];
    this.recording = true;
    this.recorder.port.postMessage({ type: 'recording', value: true });
  }

  stopRecording() {
    if (!this.recorder || !this.recording) return null;
    this.recorder.port.postMessage({ type: 'recording', value: false });
    this.recording = false;
    return encodeWav(this.recordedChunks, this.ctx.sampleRate);
  }
}

export async function initAudio() {
  if (!engine) engine = new AudioDesignEngine();
  await engine.init();
}

export function renderAudio(state, params) {
  try {
    engine?.sync(state, params);
  } catch (error) {
    console.warn('[GlidePath Audio]', error.message);
  }
}

export async function loadSampleForNode(index, file) {
  if (!engine) engine = new AudioDesignEngine();
  await engine.loadSample(index, file);
}

export function startRecording() {
  engine?.startRecording();
}

export function stopRecording() {
  return engine?.stopRecording() ?? null;
}

export function suspendAudio() {
  engine?.ctx?.suspend();
}

export function resumeAudio() {
  engine?.ctx?.resume();
}

export function isInitialized() {
  return !!engine?.ctx;
}

export function isRecording() {
  return !!engine?.recording;
}
