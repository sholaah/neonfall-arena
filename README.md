# Neonfall Arena

A neon arena survival shooter for the desktop browser. The swarm falls in waves; you are
the wall it breaks on. Chain kills to raise your combo multiplier, dash *through* enemies
to kill them, pick up Overdrive cells for piercing double-rate fire, and hold the arena
for as many waves as you can.

**Play it:** serve the `game/` folder with any static file server and open `index.html`
in desktop Chrome — or run `node serve.ts` here and visit http://localhost:8080. No
network, no build step, no dependencies: plain ES modules and a canvas.

## Controls

| Action | Keys |
| --- | --- |
| Move | WASD / arrow keys |
| Aim | Mouse |
| Fire | Hold left click / Space |
| Dash (i-frames, kills on contact) | Shift / right click / K |
| Pause | P / Esc |
| Mute | M |

## The swarm

- **Chaser** — flies straight at you. The swarm's bread and butter.
- **Weaver** — approaches on a sine wave; hard to lead, worth more.
- **Splitter** — slow and tough; breaks into three fast **minis** when killed.
- **Bloom** — a flower that parks at range and fires radial bursts; drops Overdrive often.

Every third wave restores a shield. Your combo multiplies every score while the chain is
alive (up to x8) and dies the moment you take a hit.

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output and
  writes the dossier with `vendor/makefun-game.ts`.
- `game/index.html` + `game/style.css` — the page and its chrome.
- `game/src/main.js` — bootstrap, the frame loop, and the `?shot=` screenshot stage.
- `game/src/game.js` — rules: states, waves, collisions, combo, pickups, autopilot.
- `game/src/player.js` — the ship, its dash, and its bullets.
- `game/src/enemies.js` — the four enemy kinds and the wave director.
- `game/src/world.js` — starfield, particles, floating text, screen shake.
- `game/src/audio.js` — synthesised sound effects and the bass loop (WebAudio, no files).
- `game/src/input.js` — keyboard and mouse state.
- `game/src/ui.js` — HUD, title, banners, pause and game-over screens.
- `screenshots/` — captured from the staged scenes listed in `shots.json`.

## License

MIT — see `LICENSE`.
