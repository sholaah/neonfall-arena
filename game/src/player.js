// The player's ship: movement with weight, a dash with i-frames, and the gun.
//
// The ship accelerates toward the held direction and brakes with drag, so it feels flown
// rather than teleported. The dash is the heart of the game: a 0.16 s burst at triple
// speed that makes the ship untouchable, on a 1.5 s cooldown shown as a ring around the
// ship. Bullets are plain objects the Game owns; the player only asks to spawn them.

export const PLAYER_RADIUS = 12;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = PLAYER_RADIUS;
    this.angle = -Math.PI / 2;
    this.hp = 3;
    this.maxHp = 3;
    this.fireTimer = 0;
    this.fireRate = 7; // shots per second
    this.overdrive = 0; // seconds of double-rate piercing fire left
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashDirX = 1;
    this.dashDirY = 0;
    this.invulnerable = 0; // seconds of post-hit or dash protection
    this.dead = false;
  }

  get dashReady() {
    return this.dashCooldown <= 0;
  }

  get dashing() {
    return this.dashTime > 0;
  }

  /** Seconds of protection left, from a dash or from having just been hit. */
  get protectedNow() {
    return this.invulnerable > 0 || this.dashing;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp;
    this.fireTimer = 0;
    this.overdrive = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.invulnerable = 1.2;
    this.dead = false;
  }

  /**
   * Advance one step. `move` is the held direction (each axis -1..1), `aim` the point the
   * nose follows, `wantDash` an edge-triggered dash request. Returns events the Game acts
   * on: { dashed } so it can play the sound and spawn the ghost trail.
   */
  update(dt, move, aim, wantDash, bounds) {
    const events = { dashed: false };
    this.angle = Math.atan2(aim.y - this.y, aim.x - this.x);
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.overdrive > 0) this.overdrive -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    if (wantDash && this.dashReady && !this.dead) {
      const len = Math.hypot(move.x, move.y);
      if (len > 0.01) {
        this.dashDirX = move.x / len;
        this.dashDirY = move.y / len;
      } else {
        this.dashDirX = Math.cos(this.angle);
        this.dashDirY = Math.sin(this.angle);
      }
      this.dashTime = 0.16;
      this.dashCooldown = 1.5;
      events.dashed = true;
    }

    if (this.dashing) {
      this.dashTime -= dt;
      this.vx = this.dashDirX * 1150;
      this.vy = this.dashDirY * 1150;
    } else {
      const accel = 2600;
      const len = Math.hypot(move.x, move.y);
      const nx = len > 0 ? move.x / len : 0;
      const ny = len > 0 ? move.y / len : 0;
      this.vx += nx * accel * dt;
      this.vy += ny * accel * dt;
      const drag = Math.pow(0.0015, dt); // strong drag: top speed settles near 340 px/s
      this.vx *= drag;
      this.vy *= drag;
      const speed = Math.hypot(this.vx, this.vy);
      const max = 345;
      if (speed > max) {
        this.vx = (this.vx / speed) * max;
        this.vy = (this.vy / speed) * max;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.max(this.radius, Math.min(bounds.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(bounds.height - this.radius, this.y));
    return events;
  }

  /** Whether the gun may fire now, and if so, spend the interval. */
  tryFire() {
    if (this.dead || this.fireTimer > 0) return false;
    const rate = this.overdrive > 0 ? this.fireRate * 2 : this.fireRate;
    this.fireTimer = 1 / rate;
    return true;
  }

  /** Take one hit if not protected. Returns true when the hit landed. */
  hurt() {
    if (this.protectedNow || this.dead) return false;
    this.hp -= 1;
    this.invulnerable = 1.4;
    if (this.hp <= 0) this.dead = true;
    return true;
  }

  heal() {
    if (this.hp < this.maxHp) this.hp += 1;
  }

  draw(ctx) {
    if (this.dead) return;
    const blink = this.invulnerable > 0 && !this.dashing && Math.floor(this.invulnerable * 14) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Engine glow, stronger while dashing.
    const flame = this.dashing ? 26 : 14 + Math.random() * 5;
    const grad = ctx.createLinearGradient(-this.radius, 0, -this.radius - flame, 0);
    grad.addColorStop(0, 'rgba(103, 232, 249, 0.9)');
    grad.addColorStop(1, 'rgba(103, 232, 249, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-this.radius + 2, -4.5);
    ctx.lineTo(-this.radius - flame, 0);
    ctx.lineTo(-this.radius + 2, 4.5);
    ctx.closePath();
    ctx.fill();
    // Hull: a sleek arrow in cyan, with a white core line.
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0e7490';
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ecfeff';
    ctx.beginPath();
    ctx.arc(3, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Dash cooldown ring: fills as the dash comes back.
    if (!this.dashReady) {
      const frac = 1 - this.dashCooldown / 1.5;
      ctx.strokeStyle = 'rgba(165, 243, 252, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 7, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
    // Overdrive aura.
    if (this.overdrive > 0) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 4 + Math.sin(performance.now() / 90) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** A player bullet: a bright capsule with a short life, optionally piercing. */
export function makeBullet(x, y, angle, piercing) {
  const speed = 780;
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    life: 0.9,
    piercing: Boolean(piercing),
    dead: false,
  };
}

export function drawBullet(ctx, b) {
  ctx.save();
  ctx.shadowColor = b.piercing ? '#facc15' : '#67e8f9';
  ctx.shadowBlur = 10;
  ctx.fillStyle = b.piercing ? '#fde68a' : '#cffafe';
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
