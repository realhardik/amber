import test from 'node:test';
import assert from 'node:assert/strict';
import { snap } from '../../src/plugins/snap.js';
import { Motion } from '../../src/motion.js';

function fixture({ orientation = 'vertical', position = 50, limit = 300, infinite = false,
  mode = 'mandatory', snapDistance, children = [] } = {}) {
  const motion = new Motion({ orientation, infinite });
  motion.setLimit(limit);
  motion.jump(position);
  const amber = {
    options: { snap: mode, snapDistance }, motion, touch: { id: null },
    driver: {
      axis: motion.axis, isMultiAxis: orientation === 'both', viewport: { width: 100, height: 100 },
      content: { children }, contentOffset: 0,
      destination: element => element.start[motion.axis],
      destinationVector: element => element.start,
    },
    moves: [], moveTo(value) { this.moves.push(value); },
  };
  snap.install(amber);
  amber.snap.pending = true;
  return amber;
}

function element(x, y, width = 1, height = 1, avoid = false) {
  return { start: { x, y }, hasAttribute: () => avoid,
    getBoundingClientRect: () => ({ width, height }) };
}

for (const orientation of ['vertical', 'horizontal']) {
  test(`${orientation}: snap ties choose the later edge, and proximity includes its boundary`, () => {
    const children = [element(40, 40), element(60, 60)];
    for (const [radius, expected] of [[10, [60]], [9, []]]) {
      const amber = fixture({ orientation, children, mode: 'proximity', snapDistance: radius });
      assert.equal(amber.snap.settle(), expected.length > 0);
      assert.deepEqual(amber.moves.map(value => value[amber.motion.axis]), expected);
    }
  });

  test(`${orientation}: cached panel geometry preserves oversized trailing edges and tiny-gap tolerance`, () => {
    const panel = element(40, 40);
    panel.getBoundingClientRect = () => { throw new Error('Culled panel geometry must not be read'); };
    const amber = fixture({ orientation, position: 145, children: [panel] });
    amber.driver.items = [{ element: panel, start: 40, extent: 200 }];
    assert.equal(amber.snap.settle(), true);
    assert.deepEqual(amber.moves.map(value => value[amber.motion.axis]), [140]);
    amber.motion.jump(140.005);
    amber.snap.pending = true;
    assert.equal(amber.snap.settle(), false);
    assert.equal(amber.moves.length, 1);
  });
}

test('2D snapping clamps finite axes and selects the closest occurrence on looped axes', () => {
  const amber = fixture({ orientation: 'both', position: { x: 95, y: 95 }, limit: { x: 100, y: 100 },
    infinite: { y: true }, children: [element(150, 0), element(95, 95, 1, 1, true)] });
  assert.equal(amber.snap.settle(), true);
  assert.deepEqual(amber.moves, [{ x: 100, y: 100 }]);
});

test('2D snapping retains exact subpixel destinations instead of using the 1D tolerance', () => {
  const amber = fixture({ orientation: 'both', position: { x: 50.005, y: 50 }, limit: { x: 100, y: 100 },
    children: [element(50, 50)] });
  assert.equal(amber.snap.settle(), true);
  assert.deepEqual(amber.moves, [{ x: 50, y: 50 }]);
  amber.motion.jump({ x: 50, y: 50 });
  amber.snap.pending = true;
  assert.equal(amber.snap.settle(), false);
  assert.equal(amber.moves.length, 1);
});
