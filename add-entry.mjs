import { parseFlags } from './lib/cli-flags.mjs';
import { getLocalToday } from './lib/local-today.mjs';
import { parseRows } from './lib/parse-rows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { flags } = parseFlags(process.argv.slice(2));
const dataDir = flags['data-dir'] || path.join(__dirname, 'data');
const acqPath = path.join(dataDir, 'acquisitions.md');

const business = flags.business;
const category = flags.category;
const location = flags.location;
const price = flags.price;
const sde = flags.sde;

if (!business || !category || !location || !price || !sde) {
  console.error('Error: --business, --category, --location, --price, --sde are required');
  process.exit(1);
}

const content = fs.readFileSync(acqPath, 'utf-8');
const rows = parseRows(content).filter(cells => cells.length >= 12);
const maxId = rows.reduce((max, row) => {
  const id = parseInt(row[0], 10);
  return id > max ? id : max;
}, 0);
const nextId = String(maxId + 1).padStart(3, '0');

const date = getLocalToday();
const fmtPrice = n => '$' + Number(n).toLocaleString('en-US');
const multiple = (Math.round((price / sde) * 10) / 10).toFixed(1) + 'x';
const score = flags.score !== undefined ? flags.score + '/5' : '';
const status = flags.status || 'Evaluated';
const report = flags.report || '';
const notes = flags.notes || '';

const row = `| ${nextId} | ${date} | ${business} | ${category} | ${location} | ${fmtPrice(price)} | ${fmtPrice(sde)} | ${multiple} | ${score} | ${status} | ${report} | ${notes} |`;

fs.writeFileSync(acqPath, content.trimEnd() + '\n' + row + '\n');

console.log(`Added deal ${nextId}: ${business}`);
console.log(`  Category: ${category}`);
console.log(`  Location: ${location}`);
console.log(`  Price: ${fmtPrice(price)}`);
console.log(`  SDE: ${fmtPrice(sde)}`);
console.log(`  Multiple: ${multiple}`);
console.log(`  Score: ${score || 'N/A'}`);
console.log(`  Status: ${status}`);
