import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseRenderer } from '../../src/renderers.js';

for (const axis of ['x', 'y']) {
  test(`scalar renderer write delegates on ${axis}, retains the other axis and returns actual position`, () => {
    const current = { x: 30, y: 40 };
    let written;
    const driver = {
      axis,
      readVector: () => current,
      writeVector(vector) { written = vector; return { ...vector, [axis]: 90 }; },
    };
    assert.equal(BaseRenderer.prototype.write.call(driver, 100), 90);
    assert.deepEqual(written, { ...current, [axis]: 100 });
    assert.deepEqual(current, { x: 30, y: 40 });
  });
}
