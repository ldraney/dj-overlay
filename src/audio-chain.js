/**
 * Audio chain setup for the DJ controller
 * Creates: CrossFade -> Analyser -> WaveformAnalyser -> Meter -> Master -> Destination
 */
export class AudioChain {
  constructor() {
    this.crossfade = null;
    this.analyser = null;
    this.waveformAnalyser = null;
    this.meter = null;
    this.master = null;
    this.isInitialized = false;
  }

  async init() {
    // CrossFade for mixing two decks
    this.crossfade = new Tone.CrossFade();

    // Analyser for FFT data (frequency visualization)
    this.analyser = new Tone.Analyser('fft', 1024);

    // Waveform analyser for oscilloscope visualization
    this.waveformAnalyser = new Tone.Analyser('waveform', 1024);

    // Meter for volume level
    this.meter = new Tone.Meter();

    // Master volume control
    this.master = new Tone.Volume(0);

    // Connect the chain - analysers are taps, not pass-through
    // Main audio path: crossfade -> master -> destination
    this.crossfade.connect(this.master);
    this.master.toDestination();

    // Analysis taps (don't affect audio flow)
    this.crossfade.connect(this.analyser);
    this.crossfade.connect(this.waveformAnalyser);
    this.crossfade.connect(this.meter);

    this.isInitialized = true;
  }

  /**
   * Get audio data for visuals
   * @returns {Object} frequencyData, waveformData, volume
   */
  getAudioData() {
    if (!this.isInitialized) {
      return {
        frequencyData: new Float32Array(1024),
        waveformData: new Float32Array(1024),
        volume: -Infinity
      };
    }

    return {
      frequencyData: this.analyser.getValue(),
      waveformData: this.waveformAnalyser.getValue(),
      volume: this.meter.getValue()
    };
  }

  /**
   * Connect a song's master output to a deck
   * @param {Tone.Volume} songOutput - The song's master output node
   * @param {'A' | 'B'} deck - Which deck to connect to
   */
  connectToDeck(songOutput, deck) {
    if (deck === 'A') {
      songOutput.connect(this.crossfade.a);
    } else {
      songOutput.connect(this.crossfade.b);
    }
  }

  /**
   * Set crossfade position
   * @param {number} value - 0 = Deck A, 1 = Deck B
   * @param {number} rampTime - Time in seconds to ramp
   */
  setCrossfade(value, rampTime = 0) {
    if (rampTime > 0) {
      this.crossfade.fade.rampTo(value, rampTime);
    } else {
      this.crossfade.fade.value = value;
    }
  }

  /**
   * Set master volume
   * @param {number} db - Volume in decibels
   */
  setMasterVolume(db) {
    this.master.volume.value = db;
  }

  dispose() {
    if (this.crossfade) this.crossfade.dispose();
    if (this.analyser) this.analyser.dispose();
    if (this.waveformAnalyser) this.waveformAnalyser.dispose();
    if (this.meter) this.meter.dispose();
    if (this.master) this.master.dispose();
    this.isInitialized = false;
  }
}
