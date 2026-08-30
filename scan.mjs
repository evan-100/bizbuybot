import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';
import { parseFlags } from './lib/cli-flags.mjs';
import { getLocalToday } from './lib/local-today.mjs';
import { fetchPage } from './lib/scraper.mjs';
import { getProvider, listProviders } from './providers/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function passesPriceFilter(price, range) {
  if (!range) return true;
  if (price === null) return true; // unknown price cannot be ruled out at scan stage
  const min = range.min !== undefined ? range.min : -Infinity;
  const max = range.max !== undefined ? range.max : Infinity;
  return price >= min && price <= max;
}

function passesSdeFilter(sde, range) {
  if (!range) return true;
  if (sde === null) return true; // unknown SDE cannot be ruled out at scan stage
  const min = range.min !== undefined ? range.min : -Infinity;
  const max = range.max !== undefined ? range.max : Infinity;
  return sde >= min && sde <= max;
}

function passesCategoryFilter(listing, categories) {
  if (!categories || categories.length === 0) return true;
  const haystack = `${listing.title || ''} ${listing.category || ''}`.toLowerCase();
  return categories.some((c) => haystack.includes(c.toLowerCase()));
}

function passesLocationFilter(listing, locations) {
  if (!locations || locations.length === 0) return true;
  const loc = (listing.location || '').toLowerCase();
  return locations.some((l) => loc.includes(l.toLowerCase()));
}

function passesExcludeFilter(listing, excludeKeywords) {
  if (!excludeKeywords || excludeKeywords.length === 0) return true;
  const haystack = `${listing.title || ''} ${listing.description || ''}`.toLowerCase();
  return !excludeKeywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

function passesFilters(listing, filters) {
  filters = filters || {};
  if (!passesPriceFilter(listing.price, filters.asking_price_range)) return false;
  if (!passesSdeFilter(listing.sde, filters.sde_range)) return false;
  if (!passesCategoryFilter(listing, filters.categories)) return false;
  if (!passesLocationFilter(listing, filters.locations)) return false;
  if (!passesExcludeFilter(listing, filters.exclude_keywords)) return false;
  return true;
}

function formatPipelineLine(listing) {
  const loc = listing.location || 'Unknown';
  const pricePart = listing.price !== null ? ` | Asking: ${listing.price}` : '';
  return `- [ ] ${listing.url} | ${listing.title} | ${loc}${pricePart}`;
}

function writePipelineBatch(dataDir, newLines) {
  const pipelinePath = path.join(dataDir, 'pipeline.md');
  let content = fs.readFileSync(pipelinePath, 'utf-8');
  const reversedLines = [...newLines].reverse();
  const block = reversedLines.join('\n') + '\n';
  if (content.includes('## Pending')) {
    content = content.replace(
      /## Pending\s*\n/,
      `## Pending\n${block}`,
    );
  } else {
    content = content.trimEnd() + `\n## Pending\n${block}`;
  }
  fs.writeFileSync(pipelinePath, content);
}

function firstFilterFailure(listing, filters) {
  filters = filters || {};
  if (!passesPriceFilter(listing.price, filters.asking_price_range)) return 'asking price out of range';
  if (!passesSdeFilter(listing.sde, filters.sde_range)) return 'SDE out of range';
  if (!passesCategoryFilter(listing, filters.categories)) return 'category not in preferred list';
  if (!passesLocationFilter(listing, filters.locations)) return 'location not in preferred list';
  if (!passesExcludeFilter(listing, filters.exclude_keywords)) return 'matched exclude keyword';
  return null;
}

function isRejectedRow(row) {
  const fields = row.split('\t');
  return fields.length >= 8 && fields[1] && fields[7] !== '';
}

function stripTrailingTabs(row) {
  return row.replace(/\t+$/, '').trimEnd();
}

function rejectedReasonKey(reason) {
  // Only "not in preferred list" rejections are profile/criteria-driven — the same URL
  // becomes a real match once the buyer's criteria change, so we persist them as rejected
  // rows and surface them on re-scan. Hard rejections (out of range / exclude keyword)
  // tie the URL to the OFFER, not the profile, and must NOT be stored.
  if (reason === 'category not in preferred list') return 'category';
  if (reason === 'location not in preferred list') return 'location';
  return null;
}

function readHistory(dataDir) {
  const tsvPath = path.join(dataDir, 'scan-history.tsv');
  const result = { header: '', body: [] };
  if (!fs.existsSync(tsvPath)) return result;
  const content = fs.readFileSync(tsvPath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length === 0) return result;
  result.header = lines[0];
  result.body = lines.slice(1).map(stripTrailingTabs).filter((l) => l.trim() !== '');
  return result;
}

function readExistingRows(dataDir) {
  // Map of url -> { rejected: boolean } for dedup decisions. Rejected rows still exist so
  // re-scans with broader criteria can re-surface them, but they don't block re-adding.
  const { body } = readHistory(dataDir);
  const map = new Map();
  for (const row of body) {
    const fields = row.split('\t');
    if (fields[1]) map.set(fields[1], { rejected: isRejectedRow(row) });
  }
  return map;
}

function writeHistory(dataDir, { header, body }) {
  const tsvPath = path.join(dataDir, 'scan-history.tsv');
  let h = header;
  if (!h || !h.startsWith('listing_id')) {
    h = 'listing_id\turl\ttitle\tasking_price\tsde\tsource\tfirst_seen\trejection';
  }
  if (h.startsWith('listing_id') && !h.includes('rejection')) {
    h = h.replace(/\t+$/, '') + '\trejection';
  }
  fs.writeFileSync(tsvPath, h + '\n' + body.join('\n') + '\n');
}

function compactHistory(rows) {
  // One row per URL, scan-order wins. A rejected row is superseded by any later accepted
  // row (an accepted listing is never re-proposed), and a later rejected row replaces an
  // earlier one. This keeps history linear and re-scans free of duplicates.
  const byUrl = new Map();
  for (const row of rows) {
    const fields = row.split('\t');
    const url = fields[1];
    if (!url) continue;
    const prev = byUrl.get(url);
    if (!prev || (isRejectedRow(prev) && !isRejectedRow(row))) byUrl.set(url, row);
  }
  return [...byUrl.values()];
}

function formatHistoryRow(listing) {
  const id = slugify(listing.url);
  const today = getLocalToday();
  return [
    id,
    listing.url,
    listing.title || '',
    listing.price !== null ? String(listing.price) : '',
    listing.sde !== null ? String(listing.sde) : '',
    listing.source || '',
    today,
  ].join('\t');
}

function formatRejectedRow(listing, rejectionKey) {
  const id = slugify(listing.url);
  const today = getLocalToday();
  return [id, listing.url, listing.title || '', '', '', listing.source || '', today, rejectionKey].join('\t');
}

export function processListings(listings, { dataDir, filters }) {
  const added = [];
  const skipped = [];

  const { header, body } = readHistory(dataDir);
  const existing = readExistingRows(dataDir);
  const seenInBatch = new Set();
  const newPipelineLines = [];
  const acceptedRows = [];
  const rejectedRows = [];

  for (const listing of listings) {
    const filterFailure = firstFilterFailure(listing, filters);
    if (filterFailure) {
      skipped.push({ ...listing, reason: filterFailure });
      const rejectionKey = rejectedReasonKey(filterFailure);
      if (rejectionKey) rejectedRows.push(formatRejectedRow(listing, rejectionKey));
      continue;
    }
    const prior = existing.get(listing.url);
    if (prior && !prior.rejected) {
      skipped.push({ ...listing, reason: 'duplicate (already scanned)' });
      continue;
    }
    if (seenInBatch.has(listing.url)) {
      skipped.push({ ...listing, reason: 'duplicate (already scanned)' });
      continue;
    }
    seenInBatch.add(listing.url);
    newPipelineLines.push(formatPipelineLine(listing));
    acceptedRows.push(formatHistoryRow(listing));
    added.push(listing);
  }

  if (newPipelineLines.length > 0) {
    writePipelineBatch(dataDir, newPipelineLines);
  }

  const newRows = [...acceptedRows, ...rejectedRows];
  if (newRows.length > 0) {
    const updated = compactHistory([...body, ...newRows]);
    writeHistory(dataDir, { header, body: updated });
  }

  return { added, skipped };
}

export async function scanMarketplaces(config, { dataDir }) {
  const added = [];
  const skipped = [];
  const errors = [];

  const providersConfig = config.providers || {};
  const searchQueries = config.search_queries || [];
  const filters = config.filters || {};

  for (const providerObj of listProviders()) {
    const providerConfig = providersConfig[providerObj.id];
    if (!providerConfig || !providerConfig.enabled) continue;

    for (const { query } of searchQueries) {
      if (!query.toLowerCase().includes(`site:${providerObj.id}.com`)) continue;

      const searchUrl = providerObj.buildSearchUrl(query);
      const page = await fetchPage(searchUrl);
      if (!page) {
        errors.push({ url: searchUrl, provider: providerObj.id, error: 'fetch failed' });
        continue;
      }

      let listings;
      try {
        listings = providerObj.parseSearchResults(page.html, searchUrl);
      } catch (err) {
        errors.push({ url: searchUrl, provider: providerObj.id, error: err.message });
        continue;
      }

      const result = processListings(listings, { dataDir, filters });
      added.push(...result.added);
      skipped.push(...result.skipped);
    }
  }

  return { added, skipped, errors };
}

async function main() {
  const { flags } = parseFlags(process.argv.slice(2));
  const dataDir = flags['data-dir'] || path.join(__dirname, 'data');

  const configPath = fs.existsSync(path.join(__dirname, 'portals.yml'))
    ? path.join(__dirname, 'portals.yml')
    : path.join(__dirname, 'templates', 'portals.example.yml');

  const config = yamlLoad(fs.readFileSync(configPath, 'utf-8'));

  const queries = (config.search_queries || []).length;
  const enabledProviders = listProviders().filter((p) => config.providers?.[p.id]?.enabled).map((p) => p.id);

  const result = await scanMarketplaces(config, { dataDir });

  console.log(`BizBuyBot Scan — ${getLocalToday()}`);
  console.log('━'.repeat(60));
  console.log(`Queries executed: ${queries}   Providers: ${enabledProviders.join(', ') || 'none'}`);
  console.log(`New added to pipeline: ${result.added.length}   Skipped: ${result.skipped.length}   Errors: ${result.errors.length}`);

  if (result.added.length > 0) {
    console.log('');
    console.log('New listings:');
    console.log('');
    const header = [' #', 'Asking', 'SDE', 'Mult', 'Location', 'Title', 'Source'];
    const rows = result.added.map((l, i) => {
      const multiple = l.price && l.sde ? `${(l.price / l.sde).toFixed(1)}x` : '—';
      return [
        ` ${i + 1}`,
        l.price !== null ? `$${l.price.toLocaleString()}` : '—',
        l.sde !== null ? `$${l.sde.toLocaleString()}` : '—',
        multiple,
        (l.location || '—').slice(0, 22),
        (l.title || 'Untitled').slice(0, 46),
        l.source || '—',
      ];
    });
    const widths = header.map((h, col) => Math.max(h.length, ...rows.map((r) => r[col].length)));
    const line = (cells) => cells.map((c, col) => c.padEnd(widths[col])).join(' | ');
    console.log(line(header));
    console.log(widths.map((w) => '-'.repeat(w)).join('-|-'));
    for (const r of rows) console.log(line(r));
  }

  if (result.skipped.length > 0) {
    console.log('');
    console.log(`Skipped (${result.skipped.length}):`);
    for (const s of result.skipped.slice(0, 10)) {
      console.log(`  - ${(s.title || s.url).slice(0, 60)} — ${s.reason}`);
    }
    if (result.skipped.length > 10) console.log(`  ... and ${result.skipped.length - 10} more`);
  }

  if (result.errors.length > 0) {
    console.log('');
    console.log(`Errors (${result.errors.length}):`);
    for (const err of result.errors) {
      console.error(`  - [${err.provider}] ${err.error}: ${err.url}`);
    }
  }

  if (result.added.length > 0) {
    console.log('');
    console.log('→ Review candidates and evaluate with /bizbuybot <listing-url>');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
