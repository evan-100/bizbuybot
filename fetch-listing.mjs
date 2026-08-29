#!/usr/bin/env node

import { fetchPage } from './lib/scraper.mjs';
import { parseFlags } from './lib/cli-flags.mjs';
import providers from './providers/index.mjs';

const { flags, positional } = parseFlags(process.argv.slice(2));
const url = positional[0] || flags.url;

if (!url) {
  console.error('Usage: node fetch-listing.mjs <url> [--json]');
  process.exit(1);
}

const pageData = await fetchPage(url);
if (!pageData) {
  console.error(`Failed to fetch listing from ${url}`);
  process.exit(1);
}

let provider = null;
if (url.includes('bizbuysell.com')) {
  provider = providers.getProvider('bizbuysell');
} else if (url.includes('bizquest.com')) {
  provider = providers.getProvider('bizquest');
}

let parsed = null;
if (provider) {
  // Try parsing from rendered body text first, then fall back to HTML
  parsed = provider.parseListing(pageData.text, url) || provider.parseListing(pageData.html, url);
}

if (flags.json) {
  console.log(JSON.stringify({
    url,
    title: pageData.title,
    parsed,
    text: pageData.text,
  }, null, 2));
} else {
  console.log(`=== Title ===\n${pageData.title}\n`);
  if (parsed) {
    console.log('=== Parsed Details ===');
    console.log(`Business Name:  ${parsed.title || 'N/A'}`);
    console.log(`Category:       ${parsed.category || 'N/A'}`);
    console.log(`Location:       ${parsed.location || 'N/A'}`);
    console.log(`Asking Price:   ${parsed.price ? '$' + parsed.price.toLocaleString() : 'N/A'}`);
    console.log(`Cash Flow/SDE:  ${parsed.sde ? '$' + parsed.sde.toLocaleString() : 'N/A'}`);
    console.log(`Gross Revenue:  ${parsed.revenue ? '$' + parsed.revenue.toLocaleString() : 'N/A'}`);
    console.log(`Source:         ${parsed.source || 'N/A'}\n`);
  }
  console.log('=== Full Page Content ===');
  console.log(pageData.text);
}
