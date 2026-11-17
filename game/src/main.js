// Neonfall Arena's bootstrap: canvas, the frame loop, and the screenshot stage.
//
// Normal play runs on requestAnimationFrame with a clamped step. A `?shot=<scene>` URL
// instead stages one deterministic scene (title, play, wave or over), flies it with the
// autopilot for a couple of seconds so the frame is mid-action, renders once, and raises
// window.__shotReady: that is how the entry's screenshots in shots.json are captured.

import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { Game } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas, canvas.width, canvas.height);
const sfx = new SoundFX();
const game = new Game(canvas, input, sfx);

// Audio may only start after a gesture; the first key or click unlocks it.
const unlock = () => sfx.unlock();
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });
window.addEventListener('blur', () => game.pause());

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

if (shot !== null) {
  game.stageShot(shot);
  if (shot === 'play' || shot === 'wave') {
    game.autopilot = true;
    const step = 1 / 60;
    const steps = shot === 'play' ? 120 : 130;
    for (let i = 0; i < steps; i++) game.update(step);
    game.autopilot = false;
  } else {
    for (let i = 0; i < 40; i++) game.update(1 / 60);
  }
  game.render(ctx);
  window.__shotReady = true;
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    game.handleMenuInput();
    if (game.state !== 'paused') game.update(dt);
    game.render(ctx);
    input.flush();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
