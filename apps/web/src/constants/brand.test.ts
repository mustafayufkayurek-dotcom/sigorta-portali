import {
  CORPORATE_LOGO_ORIGINAL_PNG,
  CORPORATE_LOGO_FULL,
  CORPORATE_LOGO_LIGHT,
  CORPORATE_LOGO_DARK,
  CORPORATE_LOGO_MARK,
} from './brand';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const OFFICIAL = '/meridyen-logo-original.png';
assert(CORPORATE_LOGO_ORIGINAL_PNG === OFFICIAL, 'original path');
assert(CORPORATE_LOGO_FULL === OFFICIAL, 'full alias');
assert(CORPORATE_LOGO_LIGHT === OFFICIAL, 'light alias');
assert(CORPORATE_LOGO_DARK === OFFICIAL, 'dark alias');
assert(CORPORATE_LOGO_MARK === OFFICIAL, 'mark alias');

console.log('brand.test.ts PASS');
