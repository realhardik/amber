/** Normalizes standard WheelEvent units across browsers and delta modes. */
export function wheelDelta(event, { orientation, wheelGesture, lineHeight }, viewport) {
  const mx = event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? viewport.width : 1;
  const my = event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? viewport.height : 1;
  const x = event.deltaX * mx, y = event.deltaY * my;
  return wheelGesture === "both" ? (Math.abs(x) > Math.abs(y) ? x : y)
    : wheelGesture === "vertical" ? y : wheelGesture === "horizontal" || orientation === "horizontal" ? x : y;
}

/** Both components are preserved in multi-axis mode. Caller supplies reusable storage. */
export function wheelVector(event, { wheelGesture, lineHeight }, viewport, out) {
  out.x = wheelGesture === 'vertical' ? 0 : event.deltaX * (event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? viewport.width : 1);
  out.y = wheelGesture === 'horizontal' ? 0 : event.deltaY * (event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? viewport.height : 1);
  return out;
}

export function keyDelta(event, orientation, viewport, step) {
  const p = Math.max(0, viewport - 40), k = event.key;
  return k === "ArrowUp" ? -step : k === "ArrowDown" ? step
    : k === "ArrowLeft" ? (orientation === "horizontal" ? -step : null)
    : k === "ArrowRight" ? (orientation === "horizontal" ? step : null)
    : k === "PageUp" ? -p : k === "PageDown" ? p
    : k === " " ? (event.shiftKey ? -p : p)
    : k === "Home" ? -Infinity : k === "End" ? Infinity : null;
}

export function isInteractive(element) {
  return !!element?.closest?.("input, textarea, select, button, a[href], [contenteditable]:not([contenteditable='false']), [role='slider'], [role='textbox']");
}

/** Touch velocity tracking with standard 16 ms frame units and release multiplier. */
export class TouchTracker {
  constructor() { this.cancel(); }

  start(touch, time) {
    this.id = touch.identifier;
    this.x = touch.clientX; this.y = touch.clientY;
    this.time = time;
    this.velocityX = this.velocityY = 0;
    this.moved = false;
  }

  move(touch, time) {
    const dt = Math.max(1, time - this.time), x = this.x - touch.clientX, y = this.y - touch.clientY;
    this.velocityX = (x / dt) * 16; this.velocityY = (y / dt) * 16;
    this.x = touch.clientX; this.y = touch.clientY;
    this.time = time;
    this.moved ||= x !== 0 || y !== 0;
    return { x, y };
  }

  release(orientation, time, multiplier, timeout) {
    const fresh = this.moved && time - this.time <= timeout;
    const mom = v => (fresh && Math.abs(v * multiplier) > 5 ? v * multiplier : 0);
    const result = orientation === 'both' ? { x: mom(this.velocityX), y: mom(this.velocityY) }
      : mom(orientation === 'horizontal' ? this.velocityX : this.velocityY);
    this.cancel();
    return result;
  }

  cancel() { this.id = null; this.moved = false; this.velocityX = this.velocityY = 0; }
}
