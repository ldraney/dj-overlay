import { AudioChain } from './audio-chain.js';
import { bus } from './event-bus.js';

/**
 * DJ Controller - Main orchestrator for the lofi system
 */
export class DJController {
  constructor() {
    this.audioChain = new AudioChain();
    this.deckA = null;
    this.deckB = null;
    this.activeDeck = 'A';
    this.visuals = [];
    this.visualContainer = null;
    this.isInitialized = false;
    this.animationId = null;
  }

  /**
   * Initialize the controller
   * @param {HTMLElement} visualContainer - Container element for visual canvases
   */
  async init(visualContainer) {
    await this.audioChain.init();
    this.visualContainer = visualContainer;
    this.isInitialized = true;

    // Start at deck A (crossfade = 0)
    this.audioChain.setCrossfade(0);

    console.log('[DJController] Initialized');
  }

  /**
   * Load a song into a deck
   * @param {string} songPath - Path to the song module
   * @param {'A' | 'B'} deck - Which deck to load into
   */
  async loadSong(songPath, deck = 'A') {
    console.log(`[DJController] Loading song into Deck ${deck}: ${songPath}`);

    try {
      // Dynamic import of song module
      const SongModule = await import(songPath);
      const SongClass = SongModule.default;
      const song = new SongClass();

      // Initialize the song
      await song.init();

      // Dispose old song if exists
      if (deck === 'A' && this.deckA) {
        this.deckA.dispose();
      } else if (deck === 'B' && this.deckB) {
        this.deckB.dispose();
      }

      // Store reference
      if (deck === 'A') {
        this.deckA = song;
      } else {
        this.deckB = song;
      }

      // Connect to audio chain
      this.audioChain.connectToDeck(song.getMasterOutput(), deck);

      // Forward song events to visuals
      if (song.on) {
        song.on('sectionChange', (section) => {
          bus.emit('sectionChange', { deck, section });
          this.visuals.forEach(v => v.onSectionChange?.(section));
        });

        song.on('bar', (bar) => {
          bus.emit('bar', { deck, bar });
        });
      }

      bus.emit('songLoaded', { deck, song: song.name || 'unknown' });
      console.log(`[DJController] Song loaded into Deck ${deck}`);

      return song;
    } catch (error) {
      console.error(`[DJController] Failed to load song:`, error);
      throw error;
    }
  }

  /**
   * Load a visual module
   * @param {string} visualPath - Path to the visual module
   * @param {number} layer - Z-index layer for the canvas
   */
  async loadVisual(visualPath, layer = 0) {
    console.log(`[DJController] Loading visual: ${visualPath}`);

    try {
      const VisualModule = await import(visualPath);
      const VisualClass = VisualModule.default;
      const visual = new VisualClass();

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = this.visualContainer.clientWidth || window.innerWidth;
      canvas.height = this.visualContainer.clientHeight || window.innerHeight;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.zIndex = layer;
      this.visualContainer.appendChild(canvas);

      // Initialize visual
      visual.init(canvas);
      visual._canvas = canvas;
      visual._layer = layer;

      this.visuals.push(visual);

      bus.emit('visualLoaded', { name: visual.name || 'unknown', layer });
      console.log(`[DJController] Visual loaded at layer ${layer}`);

      return visual;
    } catch (error) {
      console.error(`[DJController] Failed to load visual:`, error);
      throw error;
    }
  }

  /**
   * Remove a visual
   * @param {Object} visual - Visual instance to remove
   */
  removeVisual(visual) {
    const index = this.visuals.indexOf(visual);
    if (index > -1) {
      this.visuals.splice(index, 1);
      if (visual._canvas) {
        visual._canvas.remove();
      }
      visual.dispose?.();
    }
  }

  /**
   * Start playback
   */
  async play() {
    await Tone.start();

    const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
    if (activeSong) {
      await activeSong.play();
    }

    this.startRenderLoop();
    bus.emit('play', { deck: this.activeDeck });
  }

  /**
   * Pause playback
   */
  pause() {
    const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
    if (activeSong) {
      activeSong.pause();
    }
    bus.emit('pause', { deck: this.activeDeck });
  }

  /**
   * Stop playback
   */
  stop() {
    const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
    if (activeSong) {
      activeSong.stop();
    }
    this.stopRenderLoop();
    bus.emit('stop', { deck: this.activeDeck });
  }

  /**
   * Start crossfade to the other deck
   * @param {number} duration - Fade duration in seconds
   */
  async startCrossfade(duration = 4) {
    const targetDeck = this.activeDeck === 'A' ? 'B' : 'A';
    const targetValue = this.activeDeck === 'A' ? 1 : 0;
    const inactiveSong = this.activeDeck === 'A' ? this.deckB : this.deckA;

    if (!inactiveSong) {
      console.warn('[DJController] No song loaded in target deck');
      return;
    }

    bus.emit('crossfadeStart', { from: this.activeDeck, to: targetDeck, duration });

    // Start the inactive deck playing
    await inactiveSong.play();

    // Perform the fade
    this.audioChain.setCrossfade(targetValue, duration);

    // After fade completes, clean up
    setTimeout(() => {
      const oldSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
      if (oldSong) {
        oldSong.stop();
      }

      this.activeDeck = targetDeck;
      bus.emit('crossfadeComplete', { activeDeck: targetDeck });
    }, duration * 1000);
  }

  /**
   * Instant switch to other deck
   */
  switchDeck() {
    const targetValue = this.activeDeck === 'A' ? 1 : 0;
    this.audioChain.setCrossfade(targetValue);
    this.activeDeck = this.activeDeck === 'A' ? 'B' : 'A';
    bus.emit('deckSwitch', { activeDeck: this.activeDeck });
  }

  /**
   * Start the visual render loop
   */
  startRenderLoop() {
    if (this.animationId) return;

    const render = () => {
      // Get audio data
      const audioData = this.audioChain.getAudioData();

      // Get song state from active deck
      const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
      const songState = activeSong?.getState?.() || {
        section: 'unknown',
        bar: 0,
        beat: 0,
        bpm: 75,
        isPlaying: false
      };

      // Render all visuals
      this.visuals.forEach(visual => {
        visual.render(audioData, songState);
      });

      this.animationId = requestAnimationFrame(render);
    };

    render();
  }

  /**
   * Stop the visual render loop
   */
  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Get current state
   */
  getState() {
    const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
    return {
      activeDeck: this.activeDeck,
      deckA: this.deckA ? { name: this.deckA.name, state: this.deckA.getState?.() } : null,
      deckB: this.deckB ? { name: this.deckB.name, state: this.deckB.getState?.() } : null,
      visuals: this.visuals.map(v => ({ name: v.name, layer: v._layer })),
      isPlaying: activeSong?.getState?.()?.isPlaying || false
    };
  }

  /**
   * Forward control to active song
   */
  jumpToSection(section) {
    const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
    activeSong?.jumpToSection?.(section);
  }

  muteTrack(trackName) {
    const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
    activeSong?.muteTrack?.(trackName);
  }

  unmuteTrack(trackName) {
    const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
    activeSong?.unmuteTrack?.(trackName);
  }

  setTempo(bpm) {
    const activeSong = this.activeDeck === 'A' ? this.deckA : this.deckB;
    activeSong?.setTempo?.(bpm);
  }

  /**
   * Clean up
   */
  dispose() {
    this.stopRenderLoop();
    this.visuals.forEach(v => {
      v._canvas?.remove();
      v.dispose?.();
    });
    this.visuals = [];
    this.deckA?.dispose();
    this.deckB?.dispose();
    this.audioChain.dispose();
    bus.clear();
  }
}
