// The arena's scenery and weather: a parallax starfield, a soft grid, particle bursts,
// floating score text and the screen shake that sells every impact.
//
// Nothing here knows the rules of the game. The Game spawns effects into these pools and
// asks them to update and draw; each pool is a fixed-size ring so a long run never grows
// memory or drops frames allocating.

/** A small deterministic RNG (mulberry32), so screenshot scenes can be staged by seed. */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Starfield {
  constructor(width, height, random) {
    this.width = width;
    this.height = height;
    this.layers = [];
    const counts = [70, 46, 26];
    const speeds = [6, 14, 30];
    for (let l = 0; l < 3; l++) {
      const stars = [];
      for (let i = 0; i < counts[l]; i++) {
        stars.push({ x: random() * width, y: random() * height, r: 0.6 + l * 0.7 + random() * 0.8, tw: random() * Math.PI * 2 });
      }
      this.layers.push({ stars, speed: speeds[l] });
    }
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    for (const layer of this.layers) {
      for (const s of layer.stars) {
        s.y += layer.speed * dt;
        if (s.y > this.height + 2) {
          s.y = -2;
          s.x = Math.random() * this.width;
        }
      }
    }
  }

  draw(ctx) {
    // Deep space wash with a faint nebula glow in two corners.
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, this.width, this.height);
    let grad = ctx.createRadialGradient(this.width * 0.82, this.height * 0.12, 40, this.width * 0.82, this.height * 0.12, 520);
    grad.addColorStop(0, 'rgba(88, 28, 135, 0.20)');
    grad.addColorStop(1, 'rgba(88, 28, 135, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    grad = ctx.createRadialGradient(this.width * 0.12, this.height * 0.9, 40, this.width * 0.12, this.height * 0.9, 460);
    grad.addColorStop(0, 'rgba(8, 145, 178, 0.16)');
    grad.addColorStop(1, 'rgba(8, 145, 178, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    // The arena grid, faint enough to read as floor, not wallpaper.
    ctx.strokeStyle = 'rgba(56, 120, 180, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 64; x < this.width; x += 64) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, this.height);
    }
    for (let y = 64; y < this.height; y += 64) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.width, y + 0.5);
    }
    ctx.stroke();
    // Stars, twinkling by layer.
    for (let l = 0; l < this.layers.length; l++) {
      const layer = this.layers[l];
      ctx.fillStyle = l === 2 ? '#cfe9ff' : '#7fa8cc';
      for (const s of layer.stars) {
        const a = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 1.7 + s.tw));
        ctx.globalAlpha = a * (0.35 + l * 0.3);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** A burst of sparks with gravity-free drift and a hard fade. */
export class Particles {
  constructor(capacity = 420) {
    this.capacity = capacity;
    this.items = [];
  }

  burst(x, y, color, count, speed = 260, life = 0.55, size = 3) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.capacity) this.items.shift();
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.25 + Math.random() * 0.95);
      this.items.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: life * (0.5 + Math.random() * 0.8),
        maxLife: life,
        size: size * (0.5 + Math.random()),
        color,
      });
    }
  }

  trail(x, y, color) {
    if (this.items.length >= this.capacity) return;
    this.items.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      life: 0.32,
      maxLife: 0.32,
      size: 2.4,
      color,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.6 * dt;
      p.vy *= 1 - 2.6 * dt;
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Short-lived labels that rise and fade: score popups, combo calls, warnings. */
export class FloatTexts {
  constructor() {
    this.items = [];
  }

  add(x, y, text, color = '#e2f3ff', size = 16) {
    this.items.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
    if (this.items.length > 24) this.items.shift();
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const t = this.items[i];
      t.life -= dt;
      t.y -= 42 * dt;
      if (t.life <= 0) this.items.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.textAlign = 'center';
    for (const t of this.items) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = `700 ${t.size}px ui-monospace, Menlo, monospace`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

/** A decaying offset applied to the whole scene; kicks are added, never set. */
export class ScreenShake {
  constructor() {
    this.power = 0;
  }

  kick(power) {
    this.power = Math.min(22, this.power + power);
  }

  update(dt) {
    this.power = Math.max(0, this.power - 60 * dt);
  }

  apply(ctx) {
    if (this.power <= 0.2) return;
    const dx = (Math.random() - 0.5) * 2 * this.power;
    const dy = (Math.random() - 0.5) * 2 * this.power;
    ctx.translate(dx, dy);
  }
}
