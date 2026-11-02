// Builds an inventory from saved photos and prints it, to check against what's really in the room.
// Usage: SPACE="Living room" npm run test:inventory -- <folder of photos, or photos>
// A photo's order is its name order, so a saved scan keeps its turning order.
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { toDataUrl } from '../src/meta.js';
import { buildInventory } from '../src/inventory.js';

const PHOTO = /\.(jpe?g|png|webp)$/i;
const paths = [];
for (const arg of process.argv.slice(2)) {
  if ((await stat(arg)).isDirectory()) paths.push(...(await readdir(arg)).filter(f => PHOTO.test(f)).sort().map(f => join(arg, f)));
  else paths.push(arg);
}
if (!paths.length) throw new Error('Give me a folder of photos, or some photos.');

const mime = file => ({ '.png': 'image/png', '.webp': 'image/webp' }[extname(file).toLowerCase()] || 'image/jpeg');
const images = await Promise.all(paths.map(async p => toDataUrl(await readFile(p), mime(p))));
const { items, warnings, timing, debug } = await buildInventory(images, { space: process.env.SPACE, debug: Boolean(process.env.DEBUG_INVENTORY), onProgress: p => process.stderr.write(`${p.step} ${p.done}/${p.total}\n`) });
if (debug) {
  debug.sightings.forEach((s, id) => console.log(`${id}: photo ${s.photo} ${s.name}`));
  debug.groups.forEach(g => console.log(`group ${g.name}: ${g.sighting_ids.join(',')}`));
  console.log('');
}

for (const i of items) {
  console.log(`${i.inSpace ? 'IN  ' : 'NEAR'} ${i.area.padEnd(14)} ${i.needsReview ? '?' : ' '} ${i.quantity}× ${i.name} [${i.category}] photos ${i.photos.join(',')} ${i.view.wide ? '(wide) ' : i.view.located ? '' : '(rough box) '}- ${i.description} ${JSON.stringify(i.view?.box, (_, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))}`);
}
console.log(`\n${items.length} items from ${timing.sightings} sightings in ${paths.length} photos`);
console.log(JSON.stringify({ warnings, timing }, null, 1));
