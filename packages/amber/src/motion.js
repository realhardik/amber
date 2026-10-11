export const FRAME_MS = 1000 / 60;
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
export const wrap = (value, length) => length > 0 ? ((value % length) + length) % length : 0;
export const axesFor = orientation => orientation === 'both' ? ['x', 'y'] : [orientation === 'horizontal' ? 'x' : 'y'];

/** Vector motion integrator with primary-axis and 2D scalar accessors. */
export class Motion {
  constructor({ damping = 0.09, epsilon = 0.01, infinite = false, orientation = 'vertical' } = {}) {
    this.damping = damping;
    this.decay = Math.log1p(-damping) / FRAME_MS;
    this.epsilon = epsilon;
    this.axes = axesFor(orientation);
    this.axis = orientation === 'horizontal' ? 'x' : 'y';
    this.positionVector = { x: 0, y: 0 };
    this.targetVector = { x: 0, y: 0 };
    this.limitVector = { x: 0, y: 0 };
    this.velocityVector = { x: 0, y: 0 };
    this.directionVector = { x: 0, y: 0 };
    this.infiniteAxes = { x: false, y: false };
    this.infinite = infinite;
  }

  get position() { return this.positionVector[this.axis]; }
  get target() { return this.targetVector[this.axis]; }
  get limit() { return this.limitVector[this.axis]; }
  get velocity() { return this.velocityVector[this.axis]; }
  set velocity(value) { for (const axis of this.axes) this.velocityVector[axis] = value; }
  get direction() { return this.directionVector[this.axis]; }
  get infinite() { return this.infiniteAxes.x || this.infiniteAxes.y; }
  set infinite(value) {
    for (const axis of ['x', 'y']) this.infiniteAxes[axis] = this.axes.includes(axis) && !!(typeof value === 'object' ? value?.[axis] : value);
  }
  get isScrolling() {
    return this.positionVector.x !== this.targetVector.x || this.positionVector.y !== this.targetVector.y;
  }
  wrapped(axis) { return this.infiniteAxes[axis] ? wrap(this.positionVector[axis], this.limitVector[axis]) : this.positionVector[axis]; }
  progressAt(axis) { return this.limitVector[axis] ? this.wrapped(axis) / this.limitVector[axis] : 0; }
  get wrappedPosition() { return this.wrapped(this.axis); }
  get progress() { return this.progressAt(this.axis); }
  constrain(value, axis = this.axis) {
    return this.infiniteAxes[axis] && this.limitVector[axis] > 0 ? value : clamp(value, 0, this.limitVector[axis]);
  }
  setLimit(limit) {
    limit = this.validate(limit);
    for (const axis of this.axes) {
      const value = limit[axis];
      if (value === undefined) continue;
      this.limitVector[axis] = Math.max(0, value);
      this.positionVector[axis] = this.constrain(this.positionVector[axis], axis);
      this.targetVector[axis] = this.constrain(this.targetVector[axis], axis);
    }
    this.rebase();
  }
  validate(value) {
    if (typeof value === 'number') value = { [this.axis]: value };
    if (!value || typeof value !== 'object') throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Motion destination must be a number or vector.' : "Amber A033");
    for (const axis of this.axes) {
      const component = value[axis];
      if (component !== undefined && !Number.isFinite(component)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Motion destination must be finite.' : "Amber A034");
    }
    return value;
  }
  moveTo(position) {
    position = this.validate(position);
    for (const axis of this.axes) {
      const value = position[axis];
      if (value === undefined) continue;
      const limit = this.limitVector[axis], current = this.positionVector[axis];
      this.targetVector[axis] = this.infiniteAxes[axis] && limit > 0
        ? current + clamp(value - current, -limit, limit) : this.constrain(value, axis);
    }
  }
  jump(position) {
    position = this.validate(position);
    for (const axis of this.axes) {
      const value = position[axis];
      if (value === undefined) continue;
      this.positionVector[axis] = this.targetVector[axis] = this.constrain(value, axis);
      this.velocityVector[axis] = this.directionVector[axis] = 0;
    }
    this.rebase();
  }
  rebase() {
    for (const axis of this.axes) {
      const limit = this.limitVector[axis];
      if (!this.infiniteAxes[axis] || !limit) continue;
      const shift = Math.floor(this.positionVector[axis] / limit) * limit;
      this.positionVector[axis] -= shift;
      this.targetVector[axis] -= shift;
    }
  }
  advance(deltaTime) {
    if (!Number.isFinite(deltaTime)) throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Motion delta time must be finite.' : "Amber A035");
    if (!this.isScrolling || deltaTime <= 0) { this.velocity = 0; return false; }
    // One blend and only active components; no allocation in the frame loop.
    const blend = 1 - Math.exp(this.decay * deltaTime);
    for (const axis of this.axes) {
      const previous = this.positionVector[axis], target = this.targetVector[axis];
      let next = previous + (target - previous) * blend;
      if (Math.abs(target - next) <= this.epsilon) next = target;
      this.positionVector[axis] = next;
      this.velocityVector[axis] = (next - previous) / deltaTime;
      if (next !== previous) this.directionVector[axis] = Math.sign(next - previous);
    }
    this.rebase();
    return true;
  }
}
