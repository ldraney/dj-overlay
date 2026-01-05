# DJ Overlay - Claude Guide

The controller for the lofi music + visuals ecosystem. Manages song playback, visual rendering, and crossfading.

## Quick Start

```bash
cd ~/dj-overlay
npm start
# Server runs at http://localhost:3000
# Open http://localhost:3000/dj-overlay/ in browser
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         dj-overlay                               │
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

## File Structure

```
dj-overlay/
├── index.html          # Main UI shell
├── config.json         # Default song/visual, display settings
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

- `defaults.song` - Auto-loads this song on page load
- `defaults.visual` - Auto-loads this visual on page load
- `defaults.autoPlay` - If true, starts playback automatically (needs user gesture in browser)
- `display.showControls` - Show/hide the button bar
- `display.showStatus` - Show/hide the status bar

## The Ecosystem

```
~/
├── dj-overlay/           # THIS REPO - Controller
├── lofi-demo-song/       # Song implementation
├── lofi-*-song/          # More songs...
├── visual-waveform/      # Visual implementation
├── visual-*/             # More visuals...
├── lofi-development-docs/    # Song development docs
└── lofi-visuals-docs/        # Visual development docs
```

Songs and visuals are sibling directories. `npm start` serves from `~/` so all paths resolve.

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

## Audio Data (passed to visuals each frame)

```javascript
{
  frequencyData: Float32Array,  // 1024 FFT bins, -100 to 0 dB
  waveformData: Float32Array,   // 1024 samples, -1 to 1
  volume: number                // Meter reading
}
```

## Song State (passed to visuals each frame)

```javascript
{
  section: string,    // "intro" | "verse" | "climax" | "outro"
  bar: number,        // Current bar
  beat: number,       // Beat within bar (0-3)
  bpm: number,        // Tempo
  isPlaying: boolean
}
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

## Adding a New Song

1. Create `~/lofi-new-song/` directory
2. Implement the Song interface (see lofi-development-docs)
3. Update config.json: `"song": "/lofi-new-song/index.js"`
4. Refresh the overlay

## Adding a New Visual

1. Clone `~/visual-template/` to `~/visual-my-visual/`
2. Implement your visual (see lofi-visuals-docs)
3. Update config.json: `"visual": "/visual-my-visual/index.js"`
4. Refresh the overlay

## Development

```bash
# Start server
npm start

# Test in browser
open http://localhost:3000/dj-overlay/

# Check console for logs:
# [DJ] Config loaded
# [DJ] Controller initialized
# [DJ] Auto-loaded song
# [DJ] Auto-loaded visual
```

## Related Repos

- `~/lofi-development-docs/` - Tone.js + lofi music theory
- `~/lofi-visuals-docs/` - Canvas + audio-reactive visuals
- `~/lofi-development-docs/mapping/` - Interface specifications
