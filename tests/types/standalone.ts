import Motion, { bindScroll, resetAll, type ScrollController } from 'amber-motion';

const animation = new Motion({ el: document.createElement('div'), t: { o: [0, 1] } });
const controller: ScrollController = {
  state: { progress: .5, position: 100, wrappedPosition: 100, velocity: 0, limit: 200 },
  isDestroyed: false,
  on() { return () => {}; },
};
bindScroll(controller, animation, { source: 'velocity', start: -1, end: 1 });
resetAll([animation]);
animation.reset().play();
