// Everything the player reads: the HUD, the title screen, banners, pause and game over.
//
// All screens are drawn on the canvas in the game's monospace voice. Buttons are plain
// rectangles the Game hit-tests against the mouse, so this file only needs to agree with
// game.js about where they sit: buttonRect() is the single source for that.

const FONT = 'ui-monospace, Menlo, Consolas, monospace';

export function buttonRect(width, height, which) {
  const w = 260;
  const h = 54;
  const x = width / 2 - w / 2;
  if (which === 'start') return { x, y: height * 0.62, w, h };
  if (which === 'restart') return { x, y: height * 0.64, w, h };
  return { x, y: 0, w, h };
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function drawButton(ctx, rect, label, hover) {
  ctx.save();
  ctx.fillStyle = hover ? 'rgba(34, 211, 238, 0.28)' : 'rgba(34, 211, 238, 0.12)';
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = hover ? 22 : 10;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ecfeff';
  ctx.font = `700 21px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.restore();
}

function drawLogo(ctx, width, y) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ecfeff';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('NEONFALL', width / 2, y);
  ctx.shadowColor = '#e879f9';
  ctx.fillStyle = '#f0abfc';
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('A R E N A', width / 2, y + 52);
  ctx.restore();
}

/** The title screen: logo, the pitch, the controls, best score, and the start button. */
export function drawTitle(ctx, g, time) {
  drawLogo(ctx, g.width, g.height * 0.26);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9db8d6';
  ctx.font = `16px ${FONT}`;
  ctx.fillText('The swarm falls in waves. You are the wall it breaks on.', g.width / 2, g.height * 0.40);
  ctx.fillText('Chain kills to raise your combo. Dash through anything. Do not get touched.', g.width / 2, g.height * 0.40 + 26);
  const lines = [
    'MOVE   WASD / arrows        AIM    mouse',
    'FIRE   hold click / Space   DASH   Shift / right click',
    'PAUSE  P                    MUTE   M',
  ];
  ctx.fillStyle = '#7fa8cc';
  ctx.font = `14.5px ${FONT}`;
  lines.forEach((line, i) => ctx.fillText(line, g.width / 2, g.height * 0.485 + i * 23));
  const best = g.bestScore();
  if (best > 0) {
    ctx.fillStyle = '#facc15';
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(`BEST  ${best.toLocaleString('en-US')}`, g.width / 2, g.height * 0.585);
  }
  const hover = pointInRect(g.input.mouseX, g.input.mouseY, buttonRect(g.width, g.height, 'start'));
  drawButton(ctx, buttonRect(g.width, g.height, 'start'), '▶  LAUNCH', hover || Math.sin(time * 3) > 0.6);
  ctx.fillStyle = '#5b7ba3';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('or press Enter', g.width / 2, g.height * 0.62 + 74);
  ctx.restore();
}

/** The in-play HUD: score and combo on the left, wave and shields on the right. */
export function drawHUD(ctx, g) {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ecfeff';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(g.score.toLocaleString('en-US'), 22, 16);
  // Combo: a multiplier and a draining bar; both vanish when the chain is cold.
  if (g.combo > 1) {
    const frac = Math.max(0, g.comboTimer / g.comboWindow);
    ctx.fillStyle = '#facc15';
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(`COMBO x${g.multiplier()}`, 22, 50);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
    ctx.fillRect(22, 76, 120, 5);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(22, 76, 120 * frac, 5);
  }
  if (g.player.overdrive > 0) {
    ctx.fillStyle = '#fde68a';
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(`OVERDRIVE ${g.player.overdrive.toFixed(1)}s`, 22, 92);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9db8d6';
  ctx.font = `700 19px ${FONT}`;
  ctx.fillText(`WAVE ${g.wave}`, g.width - 22, 16);
  ctx.fillStyle = '#5b7ba3';
  ctx.font = `14px ${FONT}`;
  ctx.fillText(`best ${Math.max(g.bestScore(), g.score).toLocaleString('en-US')}`, g.width - 22, 42);
  // Shield pips.
  for (let i = 0; i < g.player.maxHp; i++) {
    const x = g.width - 34 - i * 26;
    const y = 78;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x - 8, y);
    ctx.closePath();
    if (i < g.player.hp) {
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(125, 180, 220, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The big wave call that opens each wave, fading over its last half second. */
export function drawWaveBanner(ctx, g) {
  if (g.bannerTimer <= 0) return;
  const alpha = Math.min(1, g.bannerTimer / 0.6);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.shadowColor = '#e879f9';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#fdf4ff';
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(`WAVE ${g.wave}`, g.width / 2, g.height * 0.36);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9db8d6';
  ctx.font = `16px ${FONT}`;
  ctx.fillText(g.bannerText, g.width / 2, g.height * 0.36 + 44);
  ctx.restore();
}

export function drawPaused(ctx, g) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 8, 16, 0.66)';
  ctx.fillRect(0, 0, g.width, g.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ecfeff';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText('PAUSED', g.width / 2, g.height * 0.44);
  ctx.fillStyle = '#9db8d6';
  ctx.font = `16px ${FONT}`;
  ctx.fillText('P or Esc to resume · M to mute', g.width / 2, g.height * 0.44 + 42);
  ctx.restore();
}

/** The end screen: the verdict, the run's numbers, and the way back in. */
export function drawGameOver(ctx, g, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 4, 10, 0.55)';
  ctx.fillRect(0, 0, g.width, g.height);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#fb7185';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#ffe4e6';
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText('THE FALL TAKES YOU', g.width / 2, g.height * 0.30);
  ctx.shadowBlur = 0;
  const isBest = g.score >= g.bestScore() && g.score > 0;
  ctx.fillStyle = isBest ? '#facc15' : '#ecfeff';
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(`SCORE  ${g.score.toLocaleString('en-US')}${isBest ? '  ★ NEW BEST' : ''}`, g.width / 2, g.height * 0.415);
  ctx.fillStyle = '#9db8d6';
  ctx.font = `17px ${FONT}`;
  ctx.fillText(`Reached wave ${g.wave} · ${g.kills} kills · best combo x${g.bestCombo}`, g.width / 2, g.height * 0.415 + 38);
  ctx.fillText(`Best score ${g.bestScore().toLocaleString('en-US')}`, g.width / 2, g.height * 0.415 + 66);
  const hover = pointInRect(g.input.mouseX, g.input.mouseY, buttonRect(g.width, g.height, 'restart'));
  drawButton(ctx, buttonRect(g.width, g.height, 'restart'), '↻  FLY AGAIN', hover || Math.sin(time * 3) > 0.6);
  ctx.fillStyle = '#5b7ba3';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('or press Enter', g.width / 2, g.height * 0.64 + 74);
  ctx.restore();
}

/** A one-line toast in the corner: sound on/off and similar confirmations. */
export function drawToast(ctx, g) {
  if (g.toastTimer <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, g.toastTimer);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9db8d6';
  ctx.font = `14px ${FONT}`;
  ctx.fillText(g.toast, 22, g.height - 24);
  ctx.restore();
}
