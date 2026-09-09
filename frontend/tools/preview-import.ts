import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { importLegacy } from '../src/domain/importLegacy.ts';
const [source, output] = process.argv.slice(2);
if (!source || !output || resolve(source).toLowerCase() === resolve(output).toLowerCase())
  throw Error('Usage: node tools/preview-import.ts <legacy.json> <new-output.json>');
const bytes = readFileSync(source);
const raw = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const state = importLegacy(raw);
const result = {
  format: 'av-arsenal-backup',
  version: 2,
  state,
  legacySource: raw,
  sourceSha256: createHash('sha256').update(bytes).digest('hex'),
};
mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2), { flag: 'wx' });
console.log(
  JSON.stringify({
    products: Object.keys(state.products).length,
    trips: Object.keys(state.trips).length,
    locations: Object.keys(state.locations).length,
    placements: Object.keys(state.placements).length,
    reviews: state.reviews.length,
    sourcePreserved: JSON.stringify(result.legacySource) === JSON.stringify(raw),
  }),
);
