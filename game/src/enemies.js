// The swarm: four enemy kinds, each with one clear idea, and the wave director.
//
//   chaser   flies straight at the player; the swarm's bread and butter.
//   weaver   approaches on a sine, hard to lead, worth more.
//   splitter drifts slowly and breaks into three minis when killed.
//   bloom    a stationary flower that parks at range and fires radial bursts.
//
// Enemies are plain objects made by the factories below; the Game updates and draws them
// through the two switch functions, so a kind's behaviour lives in exactly one place.

export const ENEMY_STATS = {
  chaser: { hp: 1, speed: 118, radius: 13, score: 50, color: '#fb7185' },
  weaver: { hp: 2, speed: 132, radius: 12, score: 75, color: '#c084fc' },
  splitter: { hp: 3, speed: 62, radius: 19, score: 100, color: '#fbbf24' },
  mini: { hp: 1, speed: 205, radius: 8, score: 25, color: '#fde68a' },
  bloom: { hp: 6, speed: 46, radius: 21, score: 150, color: '#34d399' },
};

let nextId = 1;

function base(kind, x, y) {
  const s = ENEMY_STATS[kind];
  return {
    id: nextId++,
    kind,
    x, y,
    vx: 0,
    vy: 0,
    hp: s.hp,
    maxHp: s.hp,
    radius: s.radius,
    score: s.score,
    color: s.color,
    age: 0,
    seed: Math.random() * Math.PI * 2,
    fireTimer: 1.2 + Math.random() * 1.4,
    flash: 0,
    dead: false,
  };
}

/** Spawn just outside a random edge, so the player always sees them arrive. */
export function spawnAtEdge(kind, bounds, random) {
  const side = Math.floor(random() * 4);
  const m = 30;
  let x = m;
  let y = m;
  if (side === 0) { x = random() * bounds.width; y = -m; }
  if (side === 1) { x = bounds.width + m; y = random() * bounds.height; }
  if (side === 2) { x = random() * bounds.width; y = bounds.height + m; }
  if (side === 3) { x = -m; y = random() * bounds.height; }
  return base(kind, x, y);
}

export function makeMini(x, y, angle) {
  const e = base('mini', x, y);
  e.vx = Math.cos(angle) * 230;
  e.vy = Math.sin(angle) * 230;
  return e;
}

/** An enemy bullet: slow, bright, and deadly only to the player. */
export function makeEnemyBullet(x, y, angle) {
  const speed = 215;
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5, life: 4, dead: false };
}

/**
 * Advance one enemy. `ctx2` carries { player, dt, shoot } where shoot(x, y, angle) queues
 * an enemy bullet. Blooms stop at range and fire in bursts; everything else hunts.
 */
export function updateEnemy(e, ctx2) {
  const { player, dt } = ctx2;
  e.age += dt;
  if (e.flash > 0) e.flash -= dt;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const s = ENEMY_STATS[e.kind];

  if (e.kind === 'chaser') {
    e.vx = ux * s.speed;
    e.vy = uy * s.speed;
  } else if (e.kind === 'weaver') {
    const sway = Math.sin(e.age * 4.4 + e.seed) * 0.85;
    const px = -uy * sway;
    const py = ux * sway;
    e.vx = (ux + px) * s.speed;
    e.vy = (uy + py) * s.speed;
  } else if (e.kind === 'splitter') {
    e.vx = ux * s.speed;
    e.vy = uy * s.speed;
  } else if (e.kind === 'mini') {
    // Minis keep their burst direction but bend toward the player.
    e.vx += ux * 620 * dt;
    e.vy += uy * 620 * dt;
    const v = Math.hypot(e.vx, e.vy) || 1;
    const target = s.speed;
    e.vx = (e.vx / v) * target;
    e.vy = (e.vy / v) * target;
  } else if (e.kind === 'bloom') {
    if (dist > 300) {
      e.vx = ux * s.speed;
      e.vy = uy * s.speed;
    } else {
      e.vx *= 1 - 4 * dt;
      e.vy *= 1 - 4 * dt;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && !player.dead) {
        e.fireTimer = 2.3;
        const shots = 8;
        const offset = e.age % (Math.PI / shots);
        for (let i = 0; i < shots; i++) ctx2.shoot(e.x, e.y, offset + (i / shots) * Math.PI * 2);
        ctx2.onBloomFire?.(e);
      }
    }
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

/** The three minis a dying splitter becomes. */
export function splitInto(e) {
  const out = [];
  for (let i = 0; i < 3; i++) out.push(makeMini(e.x, e.y, (i / 3) * Math.PI * 2 + e.seed));
  return out;
}

export function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 13;
  ctx.fillStyle = flash ? '#ffffff' : e.color;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.4;

  if (e.kind === 'chaser') {
    const a = Math.atan2(e.vy, e.vx);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.kind === 'weaver') {
    ctx.rotate(e.age * 2.6 + e.seed);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const px = Math.cos(a) * 13;
      const py = Math.sin(a) * 13;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2e1065';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'splitter' || e.kind === 'mini') {
    ctx.rotate(e.age * (e.kind === 'mini' ? 3.4 : 1.1) + e.seed);
    const r = e.radius;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (e.kind === 'splitter') {
      ctx.fillStyle = 'rgba(120, 53, 15, 0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (e.kind === 'bloom') {
    const pulse = 1 + Math.sin(e.age * 3.2) * 0.07;
    ctx.scale(pulse, pulse);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + e.age * 0.7;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 13, Math.sin(a) * 13, 9.5, 5.5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  // A thin health arc for the tougher kinds, so hits visibly count.
  if (e.maxHp > 1 && e.hp < e.maxHp) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 5, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
    ctx.stroke();
  }
}

export function drawEnemyBullet(ctx, b) {
  ctx.save();
  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 9;
  ctx.fillStyle = '#a7f3d0';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The wave director: how many of each kind wave N sends, and how fast they trickle in.
 * Wave 1 is chasers only; every kind joins by wave 4; the trickle tightens as waves grow.
 */
export function waveComposition(wave) {
  const comp = { chaser: 5 + wave * 2, weaver: 0, splitter: 0, bloom: 0 };
  if (wave >= 2) comp.weaver = 2 + wave;
  if (wave >= 3) comp.splitter = 1 + Math.floor(wave / 2);
  if (wave >= 4) comp.bloom = Math.floor((wave - 2) / 2);
  return comp;
}

export function waveSpawnInterval(wave) {
  return Math.max(0.38, 1.05 - wave * 0.07);
}
