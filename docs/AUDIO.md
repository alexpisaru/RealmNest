# Audio

RealmNest makes its sound as it plays: music, the ambience of each world and effects are synthesised with Web Audio (`src/audio/`). No audio file ships with the app, nothing is downloaded and there is nothing to license.

## What plays

| | where | what |
| --- | --- | --- |
| music | everywhere | soft pads on a slow chord progression (two bars a chord), a round bass and a plucked melody wandering over a pentatonic scale. Each world has its own key, progression, tempo and brightness (`MOODS` in `music.ts`); the night is slower, sparser and darker |
| ambience | Simulation: the world's own; Home and Worlds: the islands of the map, softer; other screens: none | beds that never stop (wind, cold wind, sea, stream, fountain, city, hum, fans, space drone) and sounds that come and go at random (birds, crickets, gulls, ship horn, tram bell, lab bubbles, beeps, presses, servos). At night birds, gulls and the tram sleep, crickets start where birds sang, the city and the machines quieten |
| effects | everywhere | a quiet tick on buttons; a live task starting, finishing or failing; an approval waiting (tools, workflow approval nodes, a crew's final result); a chat reply; a workflow completed; dusk and dawn when the day/night switch changes |

The Mock simulation's pretend tasks are silent: only real runs play effects.

## On and off

Sound is **off by default**. The **Audio** switch at the bottom right of the world map (Home) turns it on or off; the same switch is at the top of Settings › General › Audio. Off is silence: the players stop and the audio context sleeps.

## Levels

Settings › General › Audio: Master, Music, Ambient, Effects (0 = off; a silent bus stops its players, so it costs nothing). A slider's value `v` becomes the gain `v^1.5`.

The ambiences are evened out by a per-world gain measured offline to about −22 dBFS RMS each (the night's are within 4 dB), the music sits at about −20 dBFS RMS at full volume, and the effects peak between −10 and −20 dBFS (the click near −26). A limiter on the master catches the rest. To measure again: render a player into an `OfflineAudioContext` (calling `tick()` from `suspend()` points) and compare RMS and peak.

## How it runs

- `AudioEngine` (`engine.ts`): master → limiter → speakers; three buses (music, ambient, effects) and a shared reverb (a generated impulse). `sceneFor(screen, world, night)` decides the music's mood and the ambience; a new ambience fades in over 2.5 s while the old one fades out, and a new world's key starts on its next chord.
- `MusicPlayer` (`music.ts`): `composeBar()` is pure and seeded (tested); the player schedules each bar about 0.4 s ahead from a 100 ms tick.
- `AmbiencePlayer` (`ambience.ts`): looping noise through filters for the beds, slowly drifting; the spots are a Poisson process (`rate` a minute).
- `playEffect` (`effects.ts`): bells, blips and breaths built from `tone()` (`synth.ts`).
- `wireAudio` (`wire.ts`): settings and navigation from the store, effects from the event bus, visibility from the document.
- Browsers keep audio silent until a gesture, so the context starts on the first click or key. While the window is hidden (minimised) the master fades out and the context is suspended.

## Tests

`src/tests/audio.test.ts`: every world has its own mood and ambience, the night swaps birds for crickets without touching the day's table, the composer stays in key and changes chord every two bars, the screens' scenes, and an engine without Web Audio never throws.

## Not yet

Per-world sound for each station (typing at desks, the coffee machine), footsteps, a choice of music styles, sounds for individual animals.
