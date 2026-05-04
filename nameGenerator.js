// Picks from `lib/nameGeneratorData.js` — expand pools there.

import { NAME_DATA } from './lib/nameGeneratorData.js';

export const NAME_ORIGINS = /** @type {const} */ (Object.keys(NAME_DATA));

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** @param {string} origin english | nordic | … | any */
/** @param {string} gender feminine | masculine | any */
export function generateName(origin, gender) {
  const origins = origin === 'any' ? Object.keys(NAME_DATA) : [origin];
  const chosenOrigin = pick(origins);
  const set = /** @type {{ feminine: string[]; masculine: string[]; surnames: string[] }} */ (
    NAME_DATA[/** @type {keyof typeof NAME_DATA} */ (chosenOrigin)] ?? NAME_DATA.english
  );

  let firstPool;
  if (gender === 'any') {
    firstPool = [...set.feminine, ...set.masculine];
  } else {
    firstPool = set[gender] ?? [...set.feminine, ...set.masculine];
  }

  const first = pick(firstPool);
  const last = pick(set.surnames);
  return `${first} ${last}`;
}
