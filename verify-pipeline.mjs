import { parseFlags } from './lib/cli-flags.mjs';
import { parseRows } from './lib/parse-rows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { flags } = parseFlags(process.argv.slice(2));
const dataDir = flags['data-dir'] || path.join(__dirname, 'data');

function getStatesPath() {
  const inDataDir = path.join(dataDir, 'states.yml');
  if (fs.existsSync(inDataDir)) return inDataDir;
  return path.join(__dirname, 'templates', 'states.yml');
}

const stateNames = new Set(
  load(fs.readFileSync(getStatesPath(), 'utf-8')).states.map(s => s.name)
);

const issues = [];

const acqPath = path.join(dataDir, 'acquisitions.md');
const acqContent = fs.readFileSync(acqPath, 'utf-8');

// Capture header column count for column-count validation
const lines = acqContent.split('\n');
const headerLine = lines.find(l => l.startsWith('|') && !l.includes('---') && l.split('|').slice(1, -1)[0]?.trim() === '#');
const headerColCount = headerLine ? headerLine.split('|').slice(1, -1).length : null;

const dataRows = parseRows(acqContent);

for (const row of dataRows) {
  const rowId = row[0] || 'unknown';
  if (headerColCount && row.length !== headerColCount) {
    issues.push(`Row ${rowId}: column count ${row.length} != expected ${headerColCount}`);
  }
}

const idSet = new Set();
for (let i = 0; i < dataRows.length; i++) {
  const id = dataRows[i][0];
  if (idSet.has(id)) issues.push(`Duplicate ID: ${id}`);
  idSet.add(id);
  const expected = String(i + 1).padStart(3, '0');
  if (id !== expected) issues.push(`ID ${id} is not sequential (expected ${expected})`);
}

for (const row of dataRows) {
  if (row.length < 10) continue;
  const [id, date, , , , askingPrice = '', sde = '', multiple = '', , status = ''] = row;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    issues.push(`Row ${id}: invalid date format "${date}"`);
  }

  if (!stateNames.has(status)) {
    issues.push(`Row ${id}: invalid status "${status}"`);
  }

  const priceNum = parseInt(askingPrice.replace(/[$,]/g, ''), 10);
  const sdeNum = parseInt(sde.replace(/[$,]/g, ''), 10);
  if (sdeNum > 0 && !isNaN(priceNum) && !isNaN(sdeNum)) {
    const expectedMul = (Math.round((priceNum / sdeNum) * 10) / 10).toFixed(1);
    const actualMul = multiple.replace(/x$/, '');
    if (actualMul !== expectedMul) {
      issues.push(`Row ${id}: multiple ${multiple} != expected ${expectedMul}x`);
    }
  }
}

const logPath = path.join(dataDir, 'status-log.tsv');
const logContent = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
for (let i = 1; i < logContent.length; i++) {
  const fields = logContent[i].split('\t');
  if (fields.length < 5) {
    issues.push(`status-log.tsv line ${i + 1}: expected 5 fields, got ${fields.length}`);
  }
}

if (issues.length === 0) {
  console.log(`Pipeline healthy. ${dataRows.length} deals checked.`);
  process.exit(0);
} else {
  console.error(`Pipeline has ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}
