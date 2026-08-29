import { parseFlags } from './lib/cli-flags.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { flags, positional } = parseFlags(process.argv.slice(2));
const dataDir = flags['data-dir'] || path.join(__dirname, 'data');

function getStatesPath() {
  const inDataDir = path.join(dataDir, 'states.yml');
  if (fs.existsSync(inDataDir)) return inDataDir;
  return path.join(__dirname, 'templates', 'states.yml');
}

function loadStates() {
  const doc = load(fs.readFileSync(getStatesPath(), 'utf-8'));
  const states = {};
  for (const s of doc.states) states[s.name] = s;
  return states;
}

const id = positional[0];
const newStatus = positional[1];
const reason = flags.reason || '';

if (!id || !newStatus) {
  console.error('Usage: set-status.mjs <id> <new_status> [--reason="..."]');
  process.exit(1);
}

const states = loadStates();

if (!(newStatus in states)) {
  console.error(`Error: "${newStatus}" is not a valid state.`);
  process.exit(1);
}

const acqPath = path.join(dataDir, 'acquisitions.md');
const content = fs.readFileSync(acqPath, 'utf-8');
const lines = content.split('\n');
let foundIndex = -1;
let currentStatus = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.startsWith('|') || line.includes('---')) continue;
  const cells = line.split('|').slice(1, -1).map(c => c.trim());
  if (cells[0] === '#' || cells.length < 12) continue;
  if (cells[0] === id) {
    foundIndex = i;
    currentStatus = cells[9];
    break;
  }
}

if (foundIndex === -1) {
  console.error(`Error: Deal ${id} not found in tracker.`);
  process.exit(1);
}

const stateDef = states[currentStatus];
if (!stateDef) {
  console.error(`Error: Current status "${currentStatus}" is not a valid state.`);
  process.exit(1);
}

if (stateDef.terminal) {
  console.error(`Error: "${currentStatus}" is a terminal state. No transitions allowed.`);
  process.exit(1);
}

const allowed = stateDef.next || [];
if (!allowed.includes(newStatus)) {
  console.error(`Error: Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(', ')}`);
  process.exit(1);
}

const cells = lines[foundIndex].split('|');
cells[10] = ` ${newStatus} `;
lines[foundIndex] = cells.join('|');
fs.writeFileSync(acqPath, lines.join('\n'));

const timestamp = new Date().toISOString();
const logPath = path.join(dataDir, 'status-log.tsv');
fs.appendFileSync(logPath, `${timestamp}\t${id}\t${currentStatus}\t${newStatus}\t${reason}\n`);

console.log(`Updated deal ${id}: ${currentStatus} → ${newStatus}`);
if (reason) console.log(`  Reason: ${reason}`);
