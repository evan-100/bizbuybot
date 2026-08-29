export function parseRows(content) {
  const rows = [];
  for (const line of content.split('\n')) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells[0] === '#') continue;
    rows.push(cells);
  }
  return rows;
}
