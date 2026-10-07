/** Original filtered-noise rain bed; starts only after an explicit gesture. */
export class RainAmbience {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  enabled = false;
  async toggle() {
    if (!this.context) {
      const c = new AudioContext();
      this.context = c;
      const buffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate),
        a = buffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < a.length; i++) {
        smooth = 0.84 * smooth + 0.16 * (Math.random() * 2 - 1);
        a[i] = smooth;
      }
      const source = c.createBufferSource(),
        filter = c.createBiquadFilter(),
        gain = c.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 2400;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(c.destination);
      source.start();
      this.source = source;
      this.gain = gain;
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    return this.enabled;
  }
  update(intensity: number) {
    if (this.context && this.gain)
      this.gain.gain.setTargetAtTime(
        this.enabled ? intensity * 0.18 : 0,
        this.context.currentTime,
        0.5,
      );
  }
  dispose() {
    this.source?.stop();
    void this.context?.close();
  }
}
