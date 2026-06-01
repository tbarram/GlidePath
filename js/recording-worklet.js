class WavRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.recording = false;
    this.port.onmessage = ({ data }) => {
      if (data?.type === 'recording') this.recording = !!data.value;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (input && output) {
      for (let channel = 0; channel < output.length; channel++) {
        const source = input[channel] ?? input[0];
        output[channel].fill(0);
        if (!source) continue;
      }
    }

    if (this.recording && input?.[0]) {
      const left = new Float32Array(input[0]);
      const right = new Float32Array(input[1] ?? input[0]);
      this.port.postMessage({ type: 'chunk', channels: [left, right] }, [left.buffer, right.buffer]);
    }

    return true;
  }
}

registerProcessor('wav-recorder', WavRecorderProcessor);
