import { Pinning, normalizePins } from '../pinning.js';
import { sharedEffects } from '../effects.js';
import { featureModule } from '../modules.js';

export const pinning = Object.freeze({
  [featureModule]: true,
  name: 'pinning',
  order: 20,
  attributes: Object.freeze(['class', 'id']),
  normalize(options) {
    options.pin = normalizePins(options.pin);
    if (options.pin?.length && options.orientation !== 'vertical') {
      throw new TypeError((typeof __AMBER_DEBUG__ === "undefined" || __AMBER_DEBUG__) ? 'Amber: pinning requires vertical scrolling.' : "Amber A050");
    }
  },
  install(amber) {
    if (amber.options.pin?.length) {
      amber.pins = new Pinning(amber.driver, sharedEffects(amber), amber.parallax,
        amber.options.pin, () => amber.scheduleResize());
    }
  },
});

export default pinning;
