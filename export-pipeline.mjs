import { parseFlags } from './lib/cli-flags.mjs';
import { parseRows } from './lib/parse-rows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { flags } = parseFlags(process.argv.slice(2));
const dataDir = flags['data-dir'] || path.join(__dirname, 'data');
const format = flags.format || 'csv';

const validFormats = ['csv', 'json'];
if (!validFormats.includes(format)) {
  console.error(`Error: invalid --format "${format}". Valid formats: ${validFormats.join(', ')}`);
  process.exit(1);
}

const acqPath = path.join(dataDir, 'acquisitions.md');
const content = fs.readFileSync(acqPath, 'utf-8');

const rows = parseRows(content)
  .filter(cells => cells.length >= 12)
  .map(cells => ({
    id: cells[0],
    date: cells[1],
    business: cells[2],
    category: cells[3],
    location: cells[4],
    asking_price: parseInt(cells[5].replace(/[$,]/g, ''), 10),
    sde: parseInt(cells[6].replace(/[$,]/g, ''), 10),
    multiple: parseFloat(cells[7].replace(/x$/, '')),
    score: cells[8] ? parseFloat(cells[8].replace(/\/5$/, '')) : null,
    status: cells[9],
    report: cells[10],
    notes: cells[11],
  }));

const headers = ['id', 'date', 'business', 'category', 'location', 'asking_price', 'sde', 'multiple', 'score', 'status', 'report', 'notes'];

if (format === 'json') {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(headers.join(','));
  for (const row of rows) {
    const values = headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    console.log(values.join(','));
  }
}
