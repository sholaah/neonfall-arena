// Neonfall Arena's rules: states, waves, collisions, combo scoring and pickups.
//
// The Game owns every entity list and the clock. Input, sound, scenery and screens live in
// their own files; this one decides what happens when things touch. States: title (with an
// attract swarm drifting behind the logo), playing, paused, and over. An autopilot can fly
// the ship instead of the input, which is how the entry's screenshots are staged.

import { Player, makeBullet, drawBullet } from './player.js';
import { spawnAtEdge, makeEnemyBullet, updateEnemy, drawEnemy, drawEnemyBullet, splitInto, waveComposition, waveSpawnInterval } from './enemies.js';
import { Starfield, Particles, FloatTexts, ScreenShake, rng } from './world.js';
import { drawTitle, drawHUD, drawWaveBanner, drawPaused, drawGameOver, drawToast, buttonRect, pointInRect } from './ui.js';

const WAVE_LINES = [
  'They fall. You hold.',
  'The weavers have found you.',
  'Splitters inbound. Aim for the core.',
  'Blooms are taking root. Burn them early.',
  'The fall thickens.',
  'No retreat. The arena is the sky.',
];

export class Game {
  constructor(canvas, input, sfx, random = Math.random) {
    this.canvas = canvas;
    this.input = input;
    this.sfx = sfx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.bounds = { width: this.width, height: this.height };
    this.starfield = new Starfield(this.width, this.height, random);
    this.particles = new Particles();
    this.texts = new FloatTexts();
    this.shake = new ScreenShake();
    this.player = new Player(this.width / 2, this.height / 2);
    this.state = 'title';
    this.time = 0;
    this.autopilot = false;
    this.resetRun();
    this.resetAttract();
  }

  resetRun() {
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTimer = 0;
    this.comboWindow = 2.5;
    this.wave = 0;
    this.phase = 'combat';
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.intermission = 0;
    this.bannerTimer = 0;
    this.bannerText = '';
    this.deathTimer = 0;
    this.toast = '';
    this.toastTimer = 0;
  }

  /** The decorative swarm behind the title screen: real enemies, no stakes. */
  resetAttract() {
    this.ghosts = [];
    const random = rng(20261115);
    const kinds = ['chaser', 'weaver', 'splitter', 'bloom', 'chaser', 'weaver'];
    for (const kind of kinds) {
      const e = spawnAtEdge(kind, this.bounds, random);
      e.x = 120 + random() * (this.width - 240);
      e.y = 110 + random() * (this.height - 220);
      this.ghosts.push(e);
    }
  }

  bestScore() {
    return Number(localStorage.getItem('neonfall-best') || 0);
  }

  saveBest() {
    if (this.score > this.bestScore()) localStorage.setItem('neonfall-best', String(this.score));
  }

  showToast(text) {
    this.toast = text;
    this.toastTimer = 1.6;
  }

  start() {
    this.resetRun();
    this.player.reset(this.width / 2, this.height / 2);
    this.state = 'playing';
    this.sfx.unlock();
    this.sfx.startMusic();
    this.startWave(1);
  }

  startWave(n) {
    this.wave = n;
    const comp = waveComposition(n);
    this.spawnQueue = [];
    for (const [kind, count] of Object.entries(comp)) {
      for (let i = 0; i < count; i++) this.spawnQueue.push(kind);
    }
    // Shuffle so kinds interleave instead of arriving in blocks.
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    this.spawnTimer = 0.4;
    this.phase = 'combat';
    this.bannerTimer = 2.0;
    this.bannerText = WAVE_LINES[Math.min(WAVE_LINES.length - 1, n - 1)];
    if (n > 1 && n % 3 === 1) {
      this.player.heal();
      this.texts.add(this.player.x, this.player.y - 30, 'SHIELD RESTORED', '#67e8f9', 15);
    }
    this.sfx.waveStart();
  }

  pause() {
    if (this.state === 'playing') this.state = 'paused';
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  /** Where the controls say to fly and fire this frame: a person, or the autopilot. */
  controls() {
    if (this.autopilot) return this.#autopilotControls();
    const move = this.input.axis();
    return {
      move,
      aim: { x: this.input.mouseX, y: this.input.mouseY },
      firing: this.input.firing(),
      dash: this.input.dashPressed(),
    };
  }

  #autopilotControls() {
    const p = this.player;
    let nearest = null;
    let nd = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nd) {
        nd = d;
        nearest = e;
      }
    }
    if (nearest === null) {
      return { move: { x: 0, y: 0 }, aim: { x: p.x + 100, y: p.y }, firing: false, dash: false };
    }
    // Keep a fighting distance: close in when far, back off when crowded.
    const dx = nearest.x - p.x;
    const dy = nearest.y - p.y;
    const want = nd > 300 ? 1 : nd < 170 ? -1 : 0;
    const move = { x: Math.sign(dx) * want, y: Math.sign(dy) * want };
    if (want === 0) move.x = Math.sign(Math.sin(this.time * 0.9));
    return { move, aim: { x: nearest.x, y: nearest.y }, firing: true, dash: nd < 90 && p.dashReady };
  }

  /** Buttons and keys that move between states; called once per frame before update. */
  handleMenuInput() {
    const start = this.input.justPressed('Enter') || this.input.justPressed('NumpadEnter');
    const clicked = this.input.justPressed('MouseLeft');
    if (this.state === 'title') {
      const r = buttonRect(this.width, this.height, 'start');
      if (start || (clicked && pointInRect(this.input.mouseX, this.input.mouseY, r))) {
        this.sfx.unlock();
        this.sfx.click();
        this.start();
      }
    } else if (this.state === 'over') {
      const r = buttonRect(this.width, this.height, 'restart');
      if (start || (clicked && pointInRect(this.input.mouseX, this.input.mouseY, r))) {
        this.sfx.click();
        this.start();
      }
    }
    if (this.input.justPressed('KeyP') || this.input.justPressed('Escape')) {
      if (this.state === 'playing' || this.state === 'paused') this.togglePause();
    }
    if (this.input.justPressed('KeyM')) {
      this.sfx.unlock();
      this.sfx.setMuted(!this.sfx.muted);
      this.showToast(this.sfx.muted ? 'Sound off' : 'Sound on');
    }
  }

  update(dt) {
    this.time += dt;
    this.starfield.update(dt);
    this.particles.update(dt);
    this.texts.update(dt);
    this.shake.update(dt);
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (this.toastTimer > 0) this.toastTimer -= dt;

    if (this.state === 'title') {
      const target = {
        x: this.width / 2 + Math.cos(this.time * 0.23) * 330,
        y: this.height / 2 + Math.sin(this.time * 0.31) * 190,
        dead: true,
      };
      for (const e of this.ghosts) {
        updateEnemy(e, { player: target, dt, shoot: () => {} });
      }
      return;
    }
    if (this.state !== 'playing') return;

    const c = this.controls();
    const events = this.player.update(dt, c.move, c.aim, c.dash, this.bounds);
    if (events.dashed) {
      this.sfx.dash();
      for (let i = 0; i < 8; i++) this.particles.trail(this.player.x, this.player.y, '#67e8f9');
    }
    if (this.player.dashing) this.particles.trail(this.player.x, this.player.y, '#22d3ee');

    // The gun.
    if (c.firing && this.player.tryFire()) {
      const nose = 18;
      const bx = this.player.x + Math.cos(this.player.angle) * nose;
      const by = this.player.y + Math.sin(this.player.angle) * nose;
      this.bullets.push(makeBullet(bx, by, this.player.angle + (Math.random() - 0.5) * 0.03, this.player.overdrive > 0));
      this.sfx.shoot();
    }

    this.#spawnStep(dt);
    this.#updateEntities(dt);
    this.#collide();
    this.#comboStep(dt);

    // Death is a beat, not a cut: the explosion plays, then the end screen.
    if (this.player.dead) {
      this.deathTimer += dt;
      if (this.deathTimer > 1.15) {
        this.state = 'over';
        this.saveBest();
        this.sfx.stopMusic();
        this.sfx.gameOver();
      }
    }
  }

  #spawnStep(dt) {
    if (this.phase === 'intermission') {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startWave(this.wave + 1);
      return;
    }
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = waveSpawnInterval(this.wave);
        const kind = this.spawnQueue.pop();
        this.enemies.push(spawnAtEdge(kind, this.bounds, Math.random));
      }
      return;
    }
    if (this.enemies.length === 0 && !this.player.dead) {
      this.phase = 'intermission';
      this.intermission = 2.2;
      this.texts.add(this.width / 2, this.height * 0.3, `WAVE ${this.wave} CLEAR`, '#a5f3fc', 22);
    }
  }

  #updateEntities(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.width + 20 || b.y < -20 || b.y > this.height + 20) b.dead = true;
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    for (const e of this.enemies) {
      updateEnemy(e, {
        player: this.player,
        dt,
        shoot: (x, y, angle) => this.enemyBullets.push(makeEnemyBullet(x, y, angle)),
        onBloomFire: () => this.sfx.enemyShoot(),
      });
      // Enemies that spawned outside walk in; once in, keep them in the arena.
      if (e.x > -40 && e.x < this.width + 40 && e.y > -40 && e.y < this.height + 40) {
        e.x = Math.max(6, Math.min(this.width - 6, e.x));
        e.y = Math.max(6, Math.min(this.height - 6, e.y));
      }
    }
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) b.dead = true;
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);

    for (const pk of this.pickups) {
      pk.age += dt;
      pk.life -= dt;
      const d = Math.hypot(this.player.x - pk.x, this.player.y - pk.y);
      if (d < 110 && !this.player.dead) {
        pk.x += ((this.player.x - pk.x) / d) * 260 * dt;
        pk.y += ((this.player.y - pk.y) / d) * 260 * dt;
      }
      if (pk.life <= 0) pk.dead = true;
    }
    this.pickups = this.pickups.filter((p) => !p.dead);
  }

  #comboStep(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
  }

  multiplier() {
    return Math.max(1, Math.min(8, this.combo));
  }

  #killEnemy(e, byDash) {
    e.dead = true;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = this.comboWindow;
    this.bestCombo = Math.max(this.bestCombo, this.multiplier());
    const points = e.score * this.multiplier();
    this.score += points;
    this.texts.add(e.x, e.y - 14, `+${points}`, e.color, e.kind === 'bloom' ? 19 : 15);
    this.particles.burst(e.x, e.y, e.color, e.kind === 'splitter' || e.kind === 'bloom' ? 26 : 15, 300, 0.6, 3.2);
    this.shake.kick(e.kind === 'bloom' ? 7 : 3.5);
    this.sfx.explode(e.kind === 'bloom' || e.kind === 'splitter');
    if (e.kind === 'splitter') {
      for (const mini of splitInto(e)) this.enemies.push(mini);
    }
    const dropChance = e.kind === 'bloom' ? 0.45 : e.kind === 'splitter' ? 0.18 : 0.03;
    if (Math.random() < dropChance) {
      this.pickups.push({ x: e.x, y: e.y, age: 0, life: 11, dead: false });
    }
    if (byDash) this.texts.add(e.x, e.y + 16, 'DASH KILL', '#a5f3fc', 13);
  }

  #collide() {
    const p = this.player;
    // Player bullets into enemies.
    for (const b of this.bullets) {
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
          e.hp -= 1;
          e.flash = 0.09;
          e.x += b.vx * 0.006;
          e.y += b.vy * 0.006;
          this.particles.burst(b.x, b.y, e.color, 4, 190, 0.3, 2.2);
          this.sfx.hit();
          if (e.hp <= 0) this.#killEnemy(e, false);
          if (!b.piercing) b.dead = true;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Enemies into the player: a dash cuts through, a touch costs a shield.
    for (const e of this.enemies) {
      if (e.dead || p.dead) continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius - 2) {
        if (p.dashing) {
          e.hp -= 2;
          e.flash = 0.09;
          if (e.hp <= 0) this.#killEnemy(e, true);
        } else if (p.hurt()) {
          this.#killEnemy(e, false);
          this.combo = 0;
          this.comboTimer = 0;
          this.shake.kick(11);
          this.particles.burst(p.x, p.y, '#fb7185', 24, 340, 0.6, 3.4);
          this.sfx.hurt();
          if (p.dead) {
            this.particles.burst(p.x, p.y, '#67e8f9', 60, 430, 1.1, 4);
            this.particles.burst(p.x, p.y, '#f0abfc', 36, 300, 1.3, 3.4);
            this.shake.kick(20);
            this.sfx.explode(true);
          }
        } else {
          // Protected by the post-hit blink: the enemy still breaks on the shield.
          this.#killEnemy(e, false);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    // Enemy bullets into the player.
    if (!p.dead) {
      for (const b of this.enemyBullets) {
        if (Math.hypot(p.x - b.x, p.y - b.y) < p.radius + b.radius) {
          b.dead = true;
          if (p.hurt()) {
            this.combo = 0;
            this.comboTimer = 0;
            this.shake.kick(11);
            this.sfx.hurt();
            if (p.dead) {
              this.particles.burst(p.x, p.y, '#67e8f9', 60, 430, 1.1, 4);
              this.shake.kick(20);
              this.sfx.explode(true);
            }
          }
        }
      }
      this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);
    }

    // Pickups into the player.
    for (const pk of this.pickups) {
      if (!p.dead && Math.hypot(p.x - pk.x, p.y - pk.y) < p.radius + 13) {
        pk.dead = true;
        p.overdrive = 6;
        this.texts.add(p.x, p.y - 18, 'OVERDRIVE!', '#fde68a', 18);
        this.sfx.pickup();
      }
    }
    this.pickups = this.pickups.filter((pk) => !pk.dead);
  }

  #drawPickup(ctx, pk) {
    const bob = Math.sin(pk.age * 4) * 3;
    const blink = pk.life < 3 && Math.floor(pk.life * 8) % 2 === 0;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.rotate(pk.age * 2.2);
    ctx.globalAlpha = blink ? 0.3 : 1;
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#713f12';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  render(ctx) {
    ctx.save();
    this.shake.apply(ctx);
    this.starfield.draw(ctx);
    if (this.state === 'title') {
      for (const e of this.ghosts) drawEnemy(ctx, e);
    } else {
      for (const pk of this.pickups) this.#drawPickup(ctx, pk);
      for (const b of this.enemyBullets) drawEnemyBullet(ctx, b);
      for (const e of this.enemies) drawEnemy(ctx, e);
      for (const b of this.bullets) drawBullet(ctx, b);
      this.player.draw(ctx);
    }
    this.particles.draw(ctx);
    this.texts.draw(ctx);
    ctx.restore();

    if (this.state === 'title') drawTitle(ctx, this, this.time);
    if (this.state === 'playing' || this.state === 'paused') {
      drawHUD(ctx, this);
      drawWaveBanner(ctx, this);
    }
    if (this.state === 'paused') drawPaused(ctx, this);
    if (this.state === 'over') drawGameOver(ctx, this, this.time);
    drawToast(ctx, this);
  }

  /**
   * Stage a deterministic scene for the entry's screenshots. main.js asks for one of
   * title / play / wave / over, runs a few autopilot steps for the action scenes, and
   * captures the frame. Everything placed here uses fixed positions, not Math.random.
   */
  stageShot(name) {
    if (name === 'title') {
      this.state = 'title';
      return;
    }
    this.start();
    this.sfx.stopMusic();
    if (name === 'play') {
      this.wave = 2;
      this.bannerTimer = 0;
      this.score = 1450;
      this.combo = 5;
      this.comboTimer = 2;
      const spots = [
        ['chaser', 880, 210], ['chaser', 960, 420], ['weaver', 300, 180],
        ['weaver', 1020, 560], ['chaser', 240, 520], ['splitter', 700, 130],
        ['chaser', 420, 620], ['weaver', 760, 330], ['chaser', 150, 350],
      ];
      for (const [kind, x, y] of spots) {
        const e = spawnAtEdge(kind, this.bounds, () => 0.5);
        e.x = x;
        e.y = y;
        this.enemies.push(e);
      }
      this.spawnQueue = ['chaser', 'weaver', 'chaser', 'splitter', 'chaser'];
      this.player.x = 560;
      this.player.y = 400;
    } else if (name === 'wave') {
      this.wave = 5;
      this.bannerTimer = 1.7;
      this.bannerText = WAVE_LINES[4];
      this.score = 8640;
      this.combo = 7;
      this.comboTimer = 2.2;
      const spots = [
        ['bloom', 190, 140], ['bloom', 1090, 580], ['splitter', 640, 150],
        ['weaver', 380, 560], ['weaver', 900, 220], ['chaser', 760, 480],
        ['chaser', 300, 300], ['chaser', 1010, 380], ['mini', 560, 250], ['mini', 600, 290],
      ];
      for (const [kind, x, y] of spots) {
        const e = spawnAtEdge(kind, this.bounds, () => 0.5);
        e.x = x;
        e.y = y;
        this.enemies.push(e);
      }
      this.spawnQueue = ['chaser', 'weaver', 'chaser'];
      this.player.x = 620;
      this.player.y = 430;
      this.player.overdrive = 4.2;
      this.pickups.push({ x: 480, y: 330, age: 1, life: 10, dead: false });
    } else if (name === 'over') {
      this.score = 12340;
      this.kills = 87;
      this.wave = 6;
      this.bestCombo = 8;
      this.saveBest();
      this.player.dead = true;
      this.player.hp = 0;
      this.state = 'over';
      this.sfx.stopMusic();
    }
  }
}
