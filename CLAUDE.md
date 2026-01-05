# Lofi DJ - Claude Guide

The controller for the lofi music + visuals ecosystem. Manages song playback, visual rendering, and crossfading.

**This repo owns the interface contracts.** Songs and visuals implement these interfaces to work with the DJ.

## Quick Start

```bash
cd ~/lofi-dj
npm start
# Server runs at http://localhost:3000
# Open http://localhost:3000/lofi-dj/ in browser
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           lofi-dj                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐     ┌──────────┐                                  │
│  │  Deck A  │     │  Deck B  │     Song Instances                │
│  │  (Song)  │     │  (Song)  │                                   │
│  └────┬─────┘     └────┬─────┘                                  │
│       └───────┬────────┘                                        │
│               ▼                                                  │
│       ┌───────────────┐                                         │
│       │  CrossFade    │     Tone.CrossFade node                 │
│       └───────┬───────┘                                         │
│               ▼                                                  │
│       ┌───────────────┐                                         │
│       │   Analyser    │     FFT + Waveform → visuals            │
│       └───────┬───────┘                                         │
│               ▼                                                  │
│       ┌───────────────┐                                         │
│       │    Master     │     → Tone.Destination (speakers)       │
│       └───────────────┘                                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Visual Stack                             │ │
│  │  Canvas layers with z-index, each running a visual module   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## The Ecosystem

```
~/
├── lofi-dj/                  # THIS REPO - Controller + Interface Contracts
├── lofi-demo-song/           # Song implementation
├── lofi-*-song/              # More songs...
├── visual-waveform/          # Visual implementation
├── visual-*/                 # More visuals...
├── lofi-development-docs/    # Deep Tone.js guides
└── lofi-visuals-docs/        # Deep Canvas guides
```

Songs and visuals are sibling directories. `npm start` serves from `~/` so all paths resolve.

---

## Project Registry

All songs and visuals are tracked in `registry.json`:

```json
{
  "songs": [
    { "name": "demo-song", "path": "/lofi-demo-song", "status": "ready", "description": "..." }
  ],
  "visuals": [
    { "name": "waveform", "path": "/visual-waveform", "status": "ready", "description": "..." }
  ]
}
```

**Statuses:** `template` | `in-progress` | `ready` | `deprecated`

The UI dropdowns only show items with `status: "ready"`.

---

## Creating Projects with Claude

This is the command center for the lofi ecosystem. When creating new songs or visuals, start here.

### Creating a New Song

1. **User requests**: "Create a new song called [name]"
2. **Claude creates** `~/lofi-[name]-song/` from `~/lofi-song-template/`
3. **Claude registers** in `registry.json` with `status: "in-progress"`
4. **Claude references** `~/lofi-development-docs/` for:
   - Chord progressions and music theory
   - Drum patterns and rhythm
   - Tone.js instrument patterns
   - Section structure and transitions
5. **Claude implements** iteratively, testing with `demo.html`
6. **When complete**, update registry status to `"ready"`
7. **Load in lofi-dj** via dropdown for full integration testing

### Creating a New Visual

1. **User requests**: "Create a new visual called [name]"
2. **Claude creates** `~/visual-[name]/` from `~/visual-template/`
3. **Claude registers** in `registry.json` with `status: "in-progress"`
4. **Claude references** `~/lofi-visuals-docs/` for:
   - Audio-reactive techniques (frequency bands, smoothing)
   - Canvas patterns and animation
   - Lofi color palettes and aesthetics
   - Section awareness
5. **Claude implements** iteratively, testing with `demo.html`
6. **When complete**, update registry status to `"ready"`
7. **Load in lofi-dj** via dropdown for full integration testing

### Templates

| Type | Location | Use |
|------|----------|-----|
| Song | `~/lofi-song-template/` | Clone for new songs |
| Visual | `~/visual-template/` | Clone for new visuals |

Each template includes:
- `index.js` - Implementation skeleton
- `manifest.json` - Metadata
- `demo.html` - Standalone test page
- `README.md` - Instructions

### Documentation References

| Topic | Location |
|-------|----------|
| Tone.js basics | `~/lofi-development-docs/00-foundations/` |
| Chord progressions | `~/lofi-development-docs/04-harmony/` |
| Drum patterns | `~/lofi-development-docs/03-rhythm/` |
| Song structure | `~/lofi-development-docs/06-arrangement/` |
| Canvas basics | `~/lofi-visuals-docs/00-foundations/` |
| Audio-reactive | `~/lofi-visuals-docs/01-audio-reactive/` |
| Lofi aesthetics | `~/lofi-visuals-docs/02-lofi-aesthetics/` |
| Visual recipes | `~/lofi-visuals-docs/03-recipes/` |

---

## Interface Contracts

### Song Interface

Songs must implement these methods:

```javascript
class MySong {
  constructor() {
    this.name = 'my-song';
  }

  // Required
  async init()           // Initialize instruments and patterns
  async play()           // Start playback
  pause()                // Pause playback
  stop()                 // Stop and reset to beginning
  getState()             // Returns songState object (see below)
  getMasterOutput()      // Returns Tone.js node for audio routing
  dispose()              // Cleanup all resources

  // Events
  on(event, callback)    // Subscribe to events
  off(event, callback)   // Unsubscribe

  // Optional
  jumpToSection(name)    // Jump to named section
  muteTrack(name)        // Mute a track
  unmuteTrack(name)      // Unmute a track
  setTempo(bpm)          // Change tempo
}

// Events to emit:
// - 'sectionChange' (sectionName)
// - 'bar' (barNumber)
```

### Visual Interface

Visuals must implement these methods:

```javascript
class MyVisual {
  constructor() {
    this.name = 'my-visual';
    this.description = 'What this visual does';
  }

  // Required
  init(canvas)                      // Receive canvas, set up context
  render(audioData, songState)      // Called every frame (~60fps)
  dispose()                         // Cleanup

  // Optional
  onSectionChange(section)          // React to section changes
  setOption(key, value)             // Configure visual
  getOptions()                      // Return current options
}
```

### Data Shapes

```javascript
// audioData (passed to visual.render() each frame)
{
  frequencyData: Float32Array,  // 1024 FFT bins, -100 to 0 dB
  waveformData: Float32Array,   // 1024 samples, -1 to 1
  volume: number                // RMS level, 0 to 1
}

// songState (passed to visual.render() each frame)
{
  section: string,    // "intro" | "verse" | "climax" | "outro"
  bar: number,        // Current bar number
  beat: number,       // Beat within bar (0-3)
  bpm: number,        // Tempo (typically 70-85 for lofi)
  isPlaying: boolean
}
```

---

## Manual Creation (Alternative)

If creating projects manually (without Claude), use the templates:

### New Song
```bash
cp -r ~/lofi-song-template ~/lofi-my-song
cd ~/lofi-my-song
# Edit manifest.json, implement index.js, test with demo.html
# Add to registry.json when ready
```

### New Visual
```bash
cp -r ~/visual-template ~/visual-my-visual
cd ~/visual-my-visual
# Edit manifest.json, implement index.js, test with demo.html
# Add to registry.json when ready
```

### Checklists

**Song:**
- [ ] Exports default class implementing Song interface
- [ ] `getState()` returns correct shape
- [ ] `getMasterOutput()` returns Tone.js node
- [ ] Emits `sectionChange` event when section changes
- [ ] `dispose()` cleans up all Tone.js objects
- [ ] Registered in `registry.json`

**Visual:**
- [ ] Exports default class implementing Visual interface
- [ ] `render()` accepts `(audioData, songState)`
- [ ] Handles missing/empty audio data gracefully
- [ ] `dispose()` cleans up canvas references
- [ ] Responds to different sections (optional but recommended)
- [ ] Registered in `registry.json`

---

## File Structure

```
lofi-dj/
├── index.html          # Main UI shell with dropdowns
├── config.json         # Default song/visual, display settings
├── registry.json       # Track all songs/visuals in ecosystem
├── styles.css          # UI styling
├── src/
│   ├── controller.js   # DJController class - main orchestrator
│   ├── audio-chain.js  # Tone.js audio routing
│   └── event-bus.js    # Event communication
└── package.json        # npm start serves from parent dir
```

## config.json

```json
{
  "server": { "port": 3000 },
  "defaults": {
    "song": "/lofi-demo-song/index.js",
    "visual": "/visual-waveform/index.js",
    "autoPlay": false
  },
  "display": {
    "showControls": true,
    "showStatus": true
  }
}
```

## DJController API

```javascript
// Load content
await controller.loadSong('/lofi-demo-song/index.js', 'A');
await controller.loadVisual('/visual-waveform/index.js', 0);

// Transport
await controller.play();
controller.pause();
controller.stop();

// Crossfade (4 second transition to other deck)
await controller.startCrossfade(4);
controller.switchDeck();  // Instant switch

// Song control (forwards to active deck)
controller.jumpToSection('climax');
controller.muteTrack('drums');
controller.unmuteTrack('drums');
controller.setTempo(85);

// State
controller.getState();  // { activeDeck, deckA, deckB, visuals, isPlaying }
```

## Event Bus

```javascript
import { bus } from './src/event-bus.js';

// Listen
bus.on('songLoaded', ({ deck, song }) => { });
bus.on('sectionChange', ({ deck, section }) => { });
bus.on('bar', ({ deck, bar }) => { });
bus.on('play', ({ deck }) => { });
bus.on('pause', ({ deck }) => { });
bus.on('stop', ({ deck }) => { });
bus.on('crossfadeStart', ({ from, to, duration }) => { });
bus.on('crossfadeComplete', ({ activeDeck }) => { });
bus.on('visualLoaded', ({ name, layer }) => { });

// Emit
bus.emit('eventName', data);
```

## Development

```bash
# Start server
npm start

# Test in browser
open http://localhost:3000/lofi-dj/

# Check console for logs:
# [DJ] Config loaded
# [DJ] Controller initialized
# [DJ] Auto-loaded song
# [DJ] Auto-loaded visual
```

## Related Repos

- `~/lofi-development-docs/` - Deep Tone.js guides + lofi music theory
- `~/lofi-visuals-docs/` - Deep Canvas guides + audio-reactive techniques
