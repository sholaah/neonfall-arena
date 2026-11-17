// Keyboard and mouse state for Neonfall Arena.
//
// One Input object owns every listener, so the rest of the game only reads plain fields:
// held keys by code, the mouse position in arena coordinates, and edge-triggered presses
// (a key that went down this frame). The canvas is scaled by CSS, so mouse events are
// mapped back into the arena's 1280x720 logical space here, once.

export class Input {
  constructor(canvas, width, height) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = width / 2;
    this.mouseY = height / 2;
    this.mouseDown = false;
    this.rightDown = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.rightDown = false;
    });
    canvas.addEventListener('mousemove', (e) => this.#mapMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.#mapMouse(e);
      if (e.button === 0) {
        this.mouseDown = true;
        this.pressed.add('MouseLeft');
      }
      if (e.button === 2) {
        this.rightDown = true;
        this.pressed.add('MouseRight');
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  #mapMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = ((e.clientX - rect.left) / rect.width) * this.width;
    this.mouseY = ((e.clientY - rect.top) / rect.height) * this.height;
  }

  /** Whether a movement direction is held: WASD or the arrow keys. */
  axis() {
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
  }

  /** Firing is the left mouse button held, or Space held. */
  firing() {
    return this.mouseDown || this.keys.has('Space');
  }

  /** A dash was requested this frame: Shift, right mouse, or the K key. */
  dashPressed() {
    return this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight') || this.pressed.has('MouseRight') || this.pressed.has('KeyK');
  }

  /** Whether a key or button went down this frame. */
  justPressed(code) {
    return this.pressed.has(code);
  }

  /** End of frame: edge-triggered presses are spent. */
  flush() {
    this.pressed.clear();
  }
}
