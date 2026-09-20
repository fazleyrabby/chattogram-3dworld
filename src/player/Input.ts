/**
 * Keyboard + mouse input collection (spec §25).
 *
 * The player controller reads state from here; nothing in this class mutates
 * game objects directly. Continuous pointer movement is accumulated per frame
 * and consumed via consumePointerDelta()/consumeWheelDelta().
 */
export class Input {
  private readonly keys = new Set<string>();
  private readonly listeners: Array<() => void> = [];

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pointerDeltaX = 0;
  private pointerDeltaY = 0;
  private wheelDelta = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bind(window, "keydown", this.onKeyDown as EventListener);
    this.bind(window, "keyup", this.onKeyUp as EventListener);
    this.bind(window, "blur", this.onBlur as EventListener);

    this.bind(canvas, "pointerdown", this.onPointerDown as EventListener);
    this.bind(window, "pointermove", this.onPointerMove as EventListener);
    this.bind(window, "pointerup", this.onPointerUp as EventListener);
    this.bind(canvas, "contextmenu", ((e: Event) =>
      e.preventDefault()) as EventListener);
    this.bind(canvas, "wheel", this.onWheel as EventListener, { passive: false });
  }

  private bind(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.listeners.push(() => target.removeEventListener(type, handler, options));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space" || e.code.startsWith("Arrow")) {
      e.preventDefault();
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.dragging = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.pointerDeltaX += e.clientX - this.lastX;
    this.pointerDeltaY += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.dragging = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.wheelDelta += e.deltaY;
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  get moveForward(): number {
    return (this.isDown("KeyW") ? 1 : 0) - (this.isDown("KeyS") ? 1 : 0);
  }

  get moveRight(): number {
    return (this.isDown("KeyD") ? 1 : 0) - (this.isDown("KeyA") ? 1 : 0);
  }

  get sprinting(): boolean {
    return this.isDown("ShiftLeft") || this.isDown("ShiftRight");
  }

  get jumpPressed(): boolean {
    return this.isDown("Space");
  }

  consumePointerDelta(): { x: number; y: number } {
    const delta = { x: this.pointerDeltaX, y: this.pointerDeltaY };
    this.pointerDeltaX = 0;
    this.pointerDeltaY = 0;
    return delta;
  }

  consumeWheelDelta(): number {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners.length = 0;
  }
}
