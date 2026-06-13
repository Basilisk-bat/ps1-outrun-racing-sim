# Neon Ridge Drift

Engine-first milestone for `ps1-outrun-racing-sim`: an original PS1-style Three.js drift game with deterministic controls, an endless ridge road, traffic, city-overlook scenery, local cover art, boost/recovery play, route recovery gates, checkpoint timer pressure, generated arcade audio, drift scoring, telemetry hooks, and browser QA.

Play in browser: https://basilisk-bat.github.io/ps1-outrun-racing-sim/

## Current Milestone

- Full-screen Three.js playable surface.
- Endless low-poly ridge highway that loops around the player, with switchbacks, elevation, width variation, road stripes, surface scuffs, section-authored roadside props, drift-zone gate landmarks, route recovery gates, deterministic traffic, and a city skyline below the overlook.
- Fixed-step arcade car simulation for acceleration, braking, steering, brake-to-drift initiation, boost charge/drain, collision recovery, offroad, collision hooks, and one-shot section recovery assists.
- Checkpoint countdown loop with grade-based time extensions, one-shot time-over telemetry, and center-screen cabinet callouts for boost, near-miss, recovery, and checkpoint awards.
- HUD/debug panels for speed, distance, ridge section, time remaining, drift score, combo, best combo, boost, authored drift-zone progress, recovery-gate state, rival gap, traffic range, collision count, near-misses, extension total, recovery state, top speed, current style, latest award, offroad time, lateral position, and run time.
- Drift-first score economy with clean driving, controlled slide scoring, authored drift-zone bonuses, near-miss bonuses, combo growth, chain breaks, traffic/offroad risk, rival pressure, and bounded telemetry history.
- Local Web Audio engine loop and original UI tones for boost, checkpoint, near-miss, collision, and time-over events after a browser input gesture.
- Original local visual assets: `public/cover-art.svg`, expanded prop silhouettes, road-surface detail, and layered sky/sunset scanline treatments.
- Deterministic calibration trace capture for a clean-line playthrough, including section deltas, grade counts, on-pace verdict, sampled frames, and browser telemetry exposure.
- Unit tests for endless ridge generation, route-section pacing, car dynamics, telemetry, traffic contacts, score economy behavior, and calibration traces.
- Playwright QA for canvas rendering, input response, HUD framing, seed-free startup, and browser-exposed drift/traffic telemetry.

## Controls

- Accelerate: `ArrowUp` or `W`
- Brake / drift initiation: `ArrowDown` or `S`
- Boost: `Space`, `Left Shift`, or `E`
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

All milestone visuals are primitive meshes, procedural geometry, CSS, and local code. The repo does not include copied Sega/OutRun branding, screenshots, music, car models, logos, levels, or trade dress. The `ps1-outrun-racing-sim` repository slug preserves the prototype prompt, while the playable game identity is original and drift-focused.

## Next Milestones

- Gameplay pass: traffic density tuning, authored combo ladders, and recovery-gate balance/playtest tuning.
- Level-design pass: city-depth treatments and additional landmark variety.
- Asset pass: car silhouette polish and optional bitmap export of the current vector cover.
- Audio pass: optional original music, richer engine modulation, and mix controls.
