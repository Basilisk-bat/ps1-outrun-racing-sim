# Neon Ridge Run

Engine-first milestone for `ps1-outrun-racing-sim`: an original PS1-style Three.js road racing prototype with deterministic controls, seeded procedural road data, telemetry hooks, and browser QA.

Play in browser: https://basilisk-bat.github.io/ps1-outrun-racing-sim/

Try a generated route variant by adding a seed, for example:
https://basilisk-bat.github.io/ps1-outrun-racing-sim/?seed=90210

## Current Milestone

- Full-screen Three.js playable surface.
- Seeded procedural highway generator with named route sections, curves, elevation, width variation, road stripes, section-authored roadside props, deterministic traffic, horizon, and a player car placeholder.
- Fixed-step car simulation for acceleration, braking, steering, drift, offroad, and collision hooks.
- HUD/debug panels for speed, distance, checkpoint, route section, split grade, style rank, traffic range, target time, checkpoint score, drift score, style chain, collision, top speed, offroad time, lateral position, and lap.
- Checkpoint split scoring with calibrated cumulative route targets, Touring/Arcade/Rival timing profiles, profile-owned score thresholds, collision/offroad penalties, deterministic drift/clean-line style scoring, chain breaks, and bounded telemetry history.
- Deterministic calibration trace capture for a clean-line playthrough, including section deltas, grade counts, on-pace verdict, sampled frames, and browser telemetry exposure.
- Unit tests for track generation, route-section pacing, car dynamics, telemetry, checkpoint scoring, score economy behavior, and calibration traces.
- Playwright QA for canvas rendering, input response, HUD framing, and browser-exposed score/calibration/traffic telemetry.

## Controls

- Accelerate: `ArrowUp` or `W`
- Brake: `ArrowDown` or `S`
- Steer: `ArrowLeft` / `ArrowRight` or `A` / `D`
- Reset car state: `R`

Difficulty profiles can be loaded with `?difficulty=touring`, `?difficulty=arcade`, or `?difficulty=rival`. Arcade is the default.

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

- Gameplay pass: boost/drift risk tuning, route splits, lap goals, and failure/recovery states.
- Level-design pass: route seed picker, longer route manifests, roadside prop set expansion, and authored checkpoint moments on top of the procedural generator.
- Asset pass: original cover art, car silhouettes, road-surface textures, sky treatments, and prop sets.
- Audio pass: original retro engine loop, UI tones, checkpoint sounds, and optional music.
