# Neon Ridge Run

Engine-first milestone for `ps1-outrun-racing-sim`: an original PS1-style Three.js road racing prototype with deterministic controls, procedural road data, telemetry hooks, and browser QA.

Play in browser: https://basilisk-bat.github.io/ps1-outrun-racing-sim/

## Current Milestone

- Full-screen Three.js playable surface.
- Low-poly procedural highway with named route sections, curves, elevation, road stripes, section-authored roadside props, horizon, and a player car placeholder.
- Fixed-step car simulation for acceleration, braking, steering, drift, offroad, and collision hooks.
- HUD/debug panels for speed, distance, checkpoint, route section, split grade, style rank, target time, checkpoint score, drift score, style chain, collision, top speed, offroad time, lateral position, and lap.
- Checkpoint split scoring with cumulative route targets, grades, collision/offroad penalties, deterministic drift/clean-line style scoring, chain breaks, and bounded telemetry history.
- Deterministic calibration trace capture for a clean-line playthrough, including section deltas, grade counts, pace verdict, sampled frames, and browser telemetry exposure.
- Unit tests for track generation, route-section pacing, car dynamics, telemetry, checkpoint scoring, score economy behavior, and calibration traces.
- Playwright QA for canvas rendering, input response, HUD framing, and browser-exposed score/calibration telemetry.

## Controls

- Accelerate: `ArrowUp` or `W`
- Brake: `ArrowDown` or `S`
- Steer: `ArrowLeft` / `ArrowRight` or `A` / `D`
- Reset car state: `R`

## Development

```powershell
npm install
npm run dev
npm run test
npm run build
npm run test:e2e
```

`npm run check` runs unit tests, the production build, and browser QA in sequence.

## Asset And IP Notes

All milestone visuals are primitive meshes, procedural geometry, CSS, and local code. The repo does not include copied Sega/OutRun branding, screenshots, music, car models, logos, levels, or trade dress. The `ps1-outrun-racing-sim` repository slug preserves the prototype prompt, while the playable game identity is original.

## Next Milestones

- Level tuning pass: use calibration trace deltas to rebalance route difficulty, target times, and scoring thresholds.
- Asset pass: original cover art, car silhouettes, road-surface textures, sky treatments, and prop sets.
- Gameplay pass: traffic, boost/drift scoring, route splits, lap goals, and failure/recovery states.
- Audio pass: original retro engine loop, UI tones, checkpoint sounds, and optional music.
