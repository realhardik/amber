import { Parallax } from '../parallax.js';
import { sharedEffects } from '../effects.js';
import { featureModule } from '../modules.js';

export const parallax = Object.freeze({
  [featureModule]: true,
  name: 'parallax',
  order: 10,
  attributes: Object.freeze(['data-amber-speed']),
  install(amber) {
    amber.parallax = new Parallax(amber.driver, sharedEffects(amber), () => amber.scheduleResize());
  },
});

export default parallax;
