[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Iyannn11/harbour-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Iyannn11/harbour-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# Harbour Run — Golden Hour Flight

A 3D flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly a small single-prop tourer over a golden-hour coastal city: thread six glowing rings over the harbour, the suspension bridge and the skyline, then bring her home onto runway 09 — and mind the fuel, because the green ring is the only top-up before the runway.

## Play

Serve `game/` with any static server and open `game/index.html` in desktop Chrome. No network requests: three.js is vendored under `game/vendor/`, all sound is synthesised with WebAudio.

| Key | Action |
| --- | --- |
| W / S or ↑ / ↓ | Pitch up / down |
| A / D or ← / → | Bank and turn |
| R / F or Shift / Ctrl | Throttle up / down |
| Space (hold) | Flaps — slow down to land |
| Mouse drag | Look around |
| R | Restart after a crash or a completed sortie |

## The sortie

1. **Rings (6 × 100 pts)** — fly through each glowing ring in order: Harbour Gate, Bay Turn, Island Turn, Coast Bend, Skyline Pass, Final Approach.
2. **Landing (up to 250 pts)** — touchdown on runway 09 is judged on centreline, speed and descent. Too fast, off-centre or hard costs points; a very hard touchdown breaks the gear.
3. **Fuel** — the tank burns with throttle. The green refuel ring over the harbour tops it up (+25 pts); landing refuels too. Run dry and the engine quits — glide her home.

Score, timer and best score (localStorage) are on the HUD, with altitude, airspeed, heading, a compass strip, an attitude ball, throttle and fuel gauges, and stall / low-fuel warnings.

## Layout

- `game/index.html` — page, HUD and screens
- `game/src/main.js` — bootstrap, chase camera, input, game loop, demo autopilot (`?demo=1`)
- `game/src/flight.js` — arcade flight model (speed, pitch, bank, stall, fuel burn)
- `game/src/terrain.js` — sea, harbour, skyline, bridges, islands, runway, clouds, sun
- `game/src/aircraft.js` — the aeroplane, built from three.js geometry
- `game/src/missions.js` — rings, landing judgement, scoring
- `game/src/hud.js` — instruments and screens
- `game/src/audio.js` — synthesised engine, wind, chimes and thuds
- `game/vendor/three.module.min.js` — vendored three.js r160
- `main.ts` — hands the game in: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
