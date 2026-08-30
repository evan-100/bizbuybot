import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizePrice } from '../lib/scraper.mjs';
import bizbuysell from '../providers/bizbuysell.mjs';
import bizquest from '../providers/bizquest.mjs';
import { getProvider, listProviders, providers } from '../providers/index.mjs';
import { processListings } from '../scan.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

// ===== Mock HTML: BizBuySell Search Results (Angular app-listing-diamond cards) =====

function bbsCard({ id, slug, title, location, description, price, cashFlow }) {
  return `<app-listing-diamond _ngcontent-bbs-c123="" class="ng-star-inserted"><a applistingclick="" appexposureclick="" class="diamond" title="${title}" href="https://www.bizbuysell.com/business-opportunity/${slug}/${id}/" id="${id}"><div inviewport="" class="listing"><div class="ng-col-10 ng-tablet-col-10 ng-mobile-col-12 details"><div class="ng-img-container"></div><div class="text"><span class="title h3 ng-star-inserted">${title}</span><!----><div class="flex g8"><!----></div><p class="location f-m ng-star-inserted">${location} </p><!----><p class="description ng-star-inserted">${description}</p><!----><p class="hide-on-desktop hide-on-tablet asking-price justify-start ng-star-inserted"><span class="flex-center"></span>${price}<!----></p><!----><p class="cash-flow-on-mobile ng-star-inserted">${cashFlow}</p><!----></div><div class="photo-count ng-star-inserted"><i class="camera icon-white"></i>2</div></div><div class="ng-col-2 ng-mobile-col-12 col-parent flex flex-column space-between"><div class="ng-col-12 ng-mobile-col-12 hide-on-mobile finance"><p class="asking-price ng-star-inserted"><span class="flex-center"></span>${price} <!----></p><!----><p class="cash-flow show-on-mobile ng-star-inserted">${cashFlow}</p><!----></div><div class="last-end-text"><span title="Favorite" class="favorite saveFavorite favorite-normal ng-star-inserted"></span></div></div></div></a><div></div><!----></app-listing-diamond>`;
}

const BBS_SEARCH_HTML = `
<html><body>
<app-bfs-listing-container><div class="listing-container">
${bbsCard({
  id: '2521001',
  slug: 'sunshine-valley-coffee-roasters-orlando-fl',
  title: 'Sunshine Valley Coffee Roasters - Orlando, FL',
  location: 'Orlando, FL',
  description: 'Sunshine Valley Coffee Roasters: an established specialty coffee roastery serving the Orlando area.',
  price: '$500,000',
  cashFlow: 'EBITDA: $382,000',
})}
${bbsCard({
  id: '2541001',
  slug: 'sunshine-valley-laundry-services-orlando-fl',
  title: 'Sunshine Valley Laundry Services - Orlando, FL',
  location: 'Orlando, FL',
  description: 'Full-service laundry and dry cleaning business for the Orlando metro.',
  price: '$200,000',
  cashFlow: 'Cash Flow: $303,000',
})}
${bbsCard({
  id: '2531001',
  slug: 'sunshine-valley-plumbing-co-orlando-fl',
  title: 'Sunshine Valley Plumbing Co - Orlando, FL',
  location: 'Orlando, FL',
  description: 'Well-established residential plumbing company serving Central Florida.',
  price: '$749,000',
  cashFlow: 'Cash Flow: $210,000',
})}
</div></app-bfs-listing-container>
</body></html>`;

// ===== Mock HTML: BizBuySell Detail Page =====

const BBS_DETAIL_HTML = `
<html><head><title>Established Turnkey Laundromat - Austin, TX | BizBuySell</title></head>
<body>
  <h1>Established Turnkey Laundromat</h1>
  <div class="financials">
    <p><span>Asking Price:</span> <span class="value">$495,000</span></p>
    <p><span>Cash Flow:</span> <span class="value">$175,000</span></p>
    <p><span>Gross Revenue:</span> <span class="value">$850,000</span></p>
    <p><span>Location:</span> <span class="value">Austin, TX</span></p>
    <p><span>Category:</span> <span class="value">Laundromats and Dry Cleaners</span></p>
  </div>
  <div class="business-description">
    <p>A prime opportunity to own an established, highly profitable coin laundry in North Austin. Features 32 washers and 28 dryers with cashless card system installed in 2024.</p>
  </div>
</body></html>`;

// ===== Mock HTML: BizQuest Search Results (Angular app-listing-diamond cards) =====

function bqsCard({ id, slug, title, city, state, description, price, cashFlowHtml }) {
  return `<app-listing-diamond _ngcontent-bq-c456="" class="ng-star-inserted"><a applistingclick="" class="diamond" title="${title}" id="${id}" href="/business-for-sale/${slug}/BW${id}/"></a><div inviewport="" class="listing"><a applistingclick="" class="diamond" title="${title}" id="${id}" href="/business-for-sale/${slug}/BW${id}/"></a><div class="ng-col-10 details"><div class="ng-img-container"></div><div class="text"><div class="ng-mobile-col-12 finance hide-on-desktop hide-on-tablet"><p class="asking-price ng-star-inserted"><span></span> ${price} <span></span></p><!----><p class="cash-flow sign-in-to-view ng-star-inserted">${cashFlowHtml.hidden || ''}</p><!----></div><h3 class="title ng-star-inserted">${title}</h3><!----></a><p class="location ng-star-inserted"><a title="Find other ${city} Businesses for Sale" href="/businesses-for-sale-in-${city.toLowerCase()}-fl/" class="ng-star-inserted">${city}</a><!----><a title="Find other ${state} Businesses for Sale" href="/businesses-for-sale-in-${state.toLowerCase()}/" class="ng-star-inserted">, ${state.split('-').pop().toUpperCase()}</a><!----></p><!----><p class="description ng-star-inserted">${description}</p><!----></div><div class="ng-col-2 ng-mobile-col-12 hide-on-mobile finance"><p class="asking-price ng-star-inserted"><span></span>${price} <span></span></p><!----><!----><p class="cash-flow sign-in-to-view ng-star-inserted">${cashFlowHtml.desktop || ''}</p><!----></div></div><div></div><!----></app-listing-diamond>`;
}

const BQ_SEARCH_HTML = `
<html><body>
<app-bfs-listing-container><div class="listing-container">
${bqsCard({
  id: '2521001',
  slug: 'sunshine-valley-coffee-roasters-orlando-fl',
  title: 'Sunshine Valley Coffee Roasters - Orlando, FL',
  city: 'Orlando',
  state: 'florida-fl',
  description: '$380K EBITDA Guarantee + 3-Year Buyback | Up to 50% Seller Financing',
  price: '$500,000',
  cashFlowHtml: {
    hidden: 'EBITDA: <span class="link-text">Sign In to View</span>',
    desktop: '<span class="link-text">View Profit</span>',
  },
})}
${bqsCard({
  id: '2541001',
  slug: 'sunshine-valley-laundry-services-orlando-fl',
  title: 'Sunshine Valley Laundry Services - Orlando, FL',
  city: 'Orlando',
  state: 'florida-fl',
  description: 'Booming and AI / Recession Proof',
  price: '$200,000',
  cashFlowHtml: {
    hidden: 'Cash Flow: <span class="link-text">Sign In to View</span>',
    desktop: '<span class="link-text">View Profit</span>',
  },
})}
${bqsCard({
  id: '2599001',
  slug: 'commercial-cleaning-co-recurring-contracts',
  title: 'Commercial Cleaning Co - Recurring Contracts',
  city: 'Tampa',
  state: 'florida-fl',
  description: 'Established commercial cleaning company with long-term contracts.',
  price: '$380,000',
  cashFlowHtml: {
    hidden: 'Cash Flow: $95,000',
    desktop: 'Cash Flow: $95,000',
  },
})}
</div></app-bfs-listing-container>
</body></html>`;

// ===== Mock HTML: BizQuest Detail Page =====

const BQ_DETAIL_HTML = `
<html><head><title>Full Service Auto Care Center - Dallas, TX | BizQuest</title></head>
<body>
  <h1>Full Service Auto Care Center</h1>
  <div class="financial-summary">
    <p><span>Asking Price:</span> <span class="price">$620,000</span></p>
    <p><span>Cash Flow:</span> <span class="value">$210,000</span></p>
    <p><span>Gross Revenue:</span> <span class="value">$1,100,000</span></p>
    <p><span>Location:</span> <span class="value">Dallas, TX</span></p>
    <p><span>Category:</span> <span class="value">Automotive / Auto Repair</span></p>
  </div>
  <div class="listing-description">
    <p>Well-established 6-bay auto repair facility with certified technicians. 15 years in continuous operation with strong recurring fleet accounts.</p>
  </div>
</body></html>`;

// ===== extractLocation =====

test('bizbuysell.extractLocation finds city and state', async () => {
  const { extractLocation } = await import('../providers/bizbuysell.mjs');
  const loc = extractLocation('plumbing business for sale Orlando Florida');
  assert.equal(loc.city, 'orlando');
  assert.equal(loc.st, 'fl');
});

test('bizbuysell.extractLocation handles postal codes', async () => {
  const { extractLocation } = await import('../providers/bizbuysell.mjs');
  const loc = extractLocation('laundromat for sale Austin TX');
  assert.equal(loc.city, 'austin');
  assert.equal(loc.st, 'tx');
});

// ===== buildSearchUrl =====

test('bizbuysell.buildSearchUrl builds state browse URL', () => {
  const url = bizbuysell.buildSearchUrl('site:bizbuysell.com laundromat for sale Texas');
  assert.ok(url.includes('bizbuysell.com'), 'should contain bizbuysell domain');
  assert.ok(!url.includes('site%3A'), 'should not contain site: encoded');
  assert.equal(url, 'https://www.bizbuysell.com/texas-businesses-for-sale/');
});

test('bizbuysell.buildSearchUrl builds city browse URL', () => {
  const url = bizbuysell.buildSearchUrl('site:bizbuysell.com plumbing business for sale Orlando Florida');
  assert.equal(url, 'https://www.bizbuysell.com/florida-businesses-for-sale/orlando/');
});

test('bizbuysell.buildSearchUrl falls back without location', () => {
  const url = bizbuysell.buildSearchUrl('laundromat for sale');
  assert.equal(url, 'https://www.bizbuysell.com/businesses-for-sale/');
});

test('bizquest.buildSearchUrl builds state browse URL', () => {
  const url = bizquest.buildSearchUrl('site:bizquest.com laundromat for sale Texas');
  assert.ok(url.includes('bizquest.com'), 'should contain bizquest domain');
  assert.ok(!url.includes('site%3A'), 'should not contain site: encoded');
  assert.equal(url, 'https://www.bizquest.com/businesses-for-sale-in-texas-tx/');
});

test('bizquest.buildSearchUrl builds city browse URL', () => {
  const url = bizquest.buildSearchUrl('site:bizquest.com HVAC business for sale Orlando Florida');
  assert.equal(url, 'https://www.bizquest.com/businesses-for-sale-in-orlando-fl/');
});

// ===== parseSearchResults: BizBuySell =====

test('bizbuysell.parseSearchResults extracts multiple listings', () => {
  const url = 'https://www.bizbuysell.com/florida-businesses-for-sale/orlando/';
  const listings = bizbuysell.parseSearchResults(BBS_SEARCH_HTML, url);
  assert.ok(Array.isArray(listings));
  assert.equal(listings.length, 3, `expected 3 listings, got ${listings.length}`);
});

test('bizbuysell.parseSearchResults extracts correct field values', () => {
  const url = 'https://www.bizbuysell.com/florida-businesses-for-sale/orlando/';
  const listings = bizbuysell.parseSearchResults(BBS_SEARCH_HTML, url);
  const first = listings[0];

  assert.equal(first.title, 'Sunshine Valley Coffee Roasters - Orlando, FL');
  assert.equal(first.price, 500000);
  assert.equal(first.location, 'Orlando, FL');
  assert.equal(first.sde, 382000);
  assert.equal(first.source, 'bizbuysell');
  assert.ok(first.url.includes('2521001'), `url should include listing id: ${first.url}`);
  assert.ok(first.description.includes('Sunshine Valley'), 'desc='+JSON.stringify(first.description));
});

test('bizbuysell.parseSearchResults listing url is absolute', () => {
  const url = 'https://www.bizbuysell.com/florida-businesses-for-sale/orlando/';
  const listings = bizbuysell.parseSearchResults(BBS_SEARCH_HTML, url);
  const first = listings[0];
  assert.ok(first.url.startsWith('https://www.bizbuysell.com'), `expected absolute URL: ${first.url}`);
});

test('bizbuysell.parseSearchResults second listing correct', () => {
  const url = 'https://www.bizbuysell.com/florida-businesses-for-sale/orlando/';
  const listings = bizbuysell.parseSearchResults(BBS_SEARCH_HTML, url);
  const second = listings[1];
  assert.equal(second.title, 'Sunshine Valley Laundry Services - Orlando, FL');
  assert.equal(second.price, 200000);
  assert.equal(second.location, 'Orlando, FL');
  assert.equal(second.sde, 303000);
});

// ===== parseSearchResults: BizQuest =====

test('bizquest.parseSearchResults extracts multiple listings', () => {
  const url = 'https://www.bizquest.com/businesses-for-sale-in-orlando-fl/';
  const listings = bizquest.parseSearchResults(BQ_SEARCH_HTML, url);
  assert.ok(Array.isArray(listings));
  assert.equal(listings.length, 3, `expected 3 listings, got ${listings.length}`);
});

test('bizquest.parseSearchResults extracts correct field values', () => {
  const url = 'https://www.bizquest.com/businesses-for-sale-in-orlando-fl/';
  const listings = bizquest.parseSearchResults(BQ_SEARCH_HTML, url);
  const first = listings[0];

  assert.equal(first.title, 'Sunshine Valley Coffee Roasters - Orlando, FL');
  assert.equal(first.price, 500000);
  assert.equal(first.location, 'Orlando, FL');
  assert.equal(first.sde, null, 'hidden cash flow should yield null SDE');
  assert.equal(first.source, 'bizquest');
  assert.ok(first.url.includes('BW2521001'), `url should include listing id: ${first.url}`);
  assert.ok(first.url.startsWith('https://www.bizquest.com'), `expected absolute URL: ${first.url}`);
});

test('bizquest.parseSearchResults parses visible cash flow', () => {
  const url = 'https://www.bizquest.com/businesses-for-sale-in-orlando-fl/';
  const listings = bizquest.parseSearchResults(BQ_SEARCH_HTML, url);
  const third = listings[2];
  assert.equal(third.title, 'Commercial Cleaning Co - Recurring Contracts');
  assert.equal(third.location, 'Tampa, FL');
  assert.equal(third.sde, 95000);
});

// ===== normalizePrice =====

test('normalizePrice handles $450,000', () => {
  assert.equal(normalizePrice('$450,000'), 450000);
});

test('normalizePrice handles $450K', () => {
  assert.equal(normalizePrice('$450K'), 450000);
});

test('normalizePrice handles $450,000.00', () => {
  assert.equal(normalizePrice('$450,000.00'), 450000);
});

test('normalizePrice returns null for garbage', () => {
  assert.equal(normalizePrice('garbage'), null);
  assert.equal(normalizePrice(null), null);
});

// ===== parseListing: BizBuySell Detail Page =====

test('bizbuysell.parseListing extracts full detail page fields', () => {
  const url = 'https://www.bizbuysell.com/business-opportunity/established-turnkey-laundromat/999999/';
  const listing = bizbuysell.parseListing(BBS_DETAIL_HTML, url);
  assert.ok(listing, 'should return a listing');
  assert.equal(listing.title, 'Established Turnkey Laundromat');
  assert.equal(listing.price, 495000);
  assert.equal(listing.sde, 175000);
  assert.equal(listing.revenue, 850000);
  assert.equal(listing.location, 'Austin, TX');
  assert.equal(listing.category, 'Laundromats and Dry Cleaners');
  assert.ok(listing.description.includes('coin laundry in North Austin'));
  assert.ok(listing.description.includes('32 washers'));
  assert.equal(listing.url, url);
  assert.equal(listing.source, 'bizbuysell');
});

// ===== parseListing: BizQuest Detail Page =====

test('bizquest.parseListing extracts full detail page fields', () => {
  const url = 'https://www.bizquest.com/business-for-sale/full-service-auto-care-center/888888/';
  const listing = bizquest.parseListing(BQ_DETAIL_HTML, url);
  assert.ok(listing, 'should return a listing');
  assert.equal(listing.title, 'Full Service Auto Care Center');
  assert.equal(listing.price, 620000);
  assert.equal(listing.sde, 210000);
  assert.equal(listing.revenue, 1100000);
  assert.equal(listing.location, 'Dallas, TX');
  assert.equal(listing.category, 'Automotive / Auto Repair');
  assert.ok(listing.description.includes('6-bay auto repair facility'));
  assert.ok(listing.description.includes('recurring fleet accounts'));
  assert.equal(listing.url, url);
  assert.equal(listing.source, 'bizquest');
});

// ===== providers/index.mjs =====

test('listProviders returns array of providers', () => {
  const list = listProviders();
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 2);
});

test('getProvider returns provider by id', () => {
  assert.equal(getProvider('bizbuysell'), bizbuysell);
  assert.equal(getProvider('bizquest'), bizquest);
});

test('getProvider returns null for unknown id', () => {
  assert.equal(getProvider('nonexistent'), null);
});

test('providers registry has both providers', () => {
  assert.ok(providers.bizbuysell);
  assert.ok(providers.bizquest);
  assert.equal(providers.bizbuysell.id, 'bizbuysell');
  assert.equal(providers.bizquest.id, 'bizquest');
});

// ===== processListings =====

function setupTempDataDir() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizbuybot-'));
  // Seed canonical minimal fixtures — never copy live data files, which change as the user adds real deals.
  fs.writeFileSync(path.join(tmpdir, 'pipeline.md'), '# BizBuyBot — Pipeline Inbox\n\n## Pending\n\n## Processed\n');
  fs.writeFileSync(path.join(tmpdir, 'scan-history.tsv'), 'listing_id\turl\ttitle\tasking_price\tsde\tsource\tfirst_seen\n');
  return tmpdir;
}

test('processListings filters out listings outside asking_price_range', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'Cheap Biz', price: 50000, sde: 60000, revenue: 100000, location: 'Austin, TX', description: null, category: null, url: 'https://www.bizbuysell.com/opportunity/aaa', source: 'bizbuysell' },
    { title: 'Good Biz', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/bbb', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: [] };
  const result = processListings(listings, { dataDir: dir, filters });
  assert.equal(result.skipped.length, 1);
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].title, 'Good Biz');
});

test('processListings filters out listings outside sde_range', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'Low SDE Biz', price: 450000, sde: 10000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/ccc', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: [] };
  const result = processListings(listings, { dataDir: dir, filters });
  assert.equal(result.skipped.length, 1);
  assert.equal(result.added.length, 0);
});

test('processListings keeps listings with unknown (null) price inside a set range', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'Unknown Price Biz', price: null, sde: 160000, revenue: null, location: 'Orlando, FL', description: null, category: null, url: 'https://www.bizquest.com/business-for-sale/uuu/UUU1/', source: 'bizquest' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: [] };
  const result = processListings(listings, { dataDir: dir, filters });
  assert.equal(result.skipped.length, 0);
  assert.equal(result.added.length, 1);
});

test('processListings skips listings matching exclude_keywords', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'Distressed Laundromat', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: 'A distressed sale', category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/ddd', source: 'bizbuysell' },
    { title: 'Good Laundromat', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: 'A great sale', category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/eee', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: ['distressed'] };
  const result = processListings(listings, { dataDir: dir, filters });
  assert.equal(result.skipped.length, 1);
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].title, 'Good Laundromat');
});

test('processListings filters by categories when set', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'Tech Startup', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Software', url: 'https://www.bizbuysell.com/opportunity/fff', source: 'bizbuysell' },
    { title: 'Austin Laundromat', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/ggg', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: ['laundromat'], exclude_keywords: [] };
  const result = processListings(listings, { dataDir: dir, filters });
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].title, 'Austin Laundromat');
});

test('processListings deduplicates against scan-history.tsv', () => {
  const dir = setupTempDataDir();
  // Pre-populate scan-history with one listing
  const tsv = fs.readFileSync(path.join(dir, 'scan-history.tsv'), 'utf-8');
  fs.writeFileSync(path.join(dir, 'scan-history.tsv'), tsv + '\nexisting-001\thttps://www.bizbuysell.com/opportunity/12345\tExisting Biz\t450000\t160000\tbizbuysell\t2026-08-22');

  const listings = [
    { title: 'Metro Laundromat', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/12345', source: 'bizbuysell' },
    { title: 'New Biz', price: 500000, sde: 170000, revenue: 900000, location: 'Dallas, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/99999', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: [] };
  const result = processListings(listings, { dataDir: dir, filters });
  assert.equal(result.added.length, 1);
  assert.equal(result.added[0].title, 'New Biz');
  assert.equal(result.skipped.length, 1);
});

test('processListings appends to pipeline.md under ## Pending', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'Pipeline Test Biz', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/ppp', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: [] };
  processListings(listings, { dataDir: dir, filters });
  const pipeline = fs.readFileSync(path.join(dir, 'pipeline.md'), 'utf-8');
  assert.match(pipeline, /## Pending[\s\S]*Pipeline Test Biz/);
  assert.match(pipeline, /https:\/\/www\.bizbuysell\.com\/opportunity\/ppp \| Pipeline Test Biz \| Austin, TX \| Asking: 450000/);
});

test('processListings omits Asking part when price is null', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'No Price Biz', price: null, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/qqq', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: null, sde_range: null, categories: [], exclude_keywords: [] };
  processListings(listings, { dataDir: dir, filters });
  const pipeline = fs.readFileSync(path.join(dir, 'pipeline.md'), 'utf-8');
  assert.match(pipeline, /https:\/\/www\.bizbuysell\.com\/opportunity\/qqq \| No Price Biz \| Austin, TX/);
  assert.ok(!pipeline.includes('Asking: null'), 'should not contain "Asking: null"');
});

test('processListings appends to scan-history.tsv', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'History Test Biz', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/rrr', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: [] };
  processListings(listings, { dataDir: dir, filters });
  const history = fs.readFileSync(path.join(dir, 'scan-history.tsv'), 'utf-8');
  const lines = history.trim().split('\n');
  assert.ok(lines.length >= 2, 'should have header + at least one row');
  const row = lines[1].split('\t');
  assert.ok(row[0], 'listing_id should be non-empty');
  assert.equal(row[1], 'https://www.bizbuysell.com/opportunity/rrr');
  assert.equal(row[2], 'History Test Biz');
  assert.equal(row[3], '450000');
  assert.equal(row[4], '160000');
  assert.equal(row[5], 'bizbuysell');
  assert.match(row[6], /^\d{4}-\d{2}-\d{2}$/, 'first_seen should be a date');
});

test('processListings deduplicates within same batch', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'Dup Biz', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/sss', source: 'bizbuysell' },
    { title: 'Dup Biz', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/sss', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: [] };
  const result = processListings(listings, { dataDir: dir, filters });
  assert.equal(result.added.length, 1);
});

test('processListings handles null price passing price filter when range is null', () => {
  const dir = setupTempDataDir();
  const listings = [
    { title: 'Null Price Biz', price: null, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: null, url: 'https://www.bizbuysell.com/opportunity/ttt', source: 'bizbuysell' },
  ];
  const filters = { asking_price_range: null, sde_range: { min: 50000, max: 500000 }, categories: [], exclude_keywords: [] };
  const result = processListings(listings, { dataDir: dir, filters });
  assert.equal(result.added.length, 1);
});

test('processListings records criteria-rejected listings and re-surfaces them on a broader re-scan', () => {
  const dir = setupTempDataDir();
  const laundromat = { title: 'Austin Laundromat', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: null, category: 'Laundromat', url: 'https://www.bizbuysell.com/opportunity/status-a', source: 'bizbuysell' };
  const houston = { title: 'Houston Cleaning Co', price: 300000, sde: 120000, revenue: 400000, location: 'Houston, TX', description: null, category: 'Cleaning', url: 'https://www.bizbuysell.com/opportunity/status-b', source: 'bizbuysell' };
  const cheap = { title: 'Cheap Biz', price: 50000, sde: 30000, revenue: 100000, location: 'Austin, TX', description: null, category: 'Cleaning', url: 'https://www.bizbuysell.com/opportunity/status-c', source: 'bizbuysell' };

  // Phase 1 — narrow criteria: only cleaning in Austin. Laundromat and HVAC are rejected on criteria.
  const narrow = { asking_price_range: null, sde_range: null, categories: ['cleaning'], locations: ['Austin'], exclude_keywords: [] };
  const r1 = processListings([laundromat, houston, cheap], { dataDir: dir, filters: narrow });
  assert.equal(r1.added.length, 1, 'only the cleaning listing is added in phase 1');
  assert.equal(r1.added[0].url, cheap.url);
  assert.equal(r1.skipped.length, 2);

  // Criteria rejections are stored in scan-history as rejected rows (8th column).
  let hist = fs.readFileSync(path.join(dir, 'scan-history.tsv'), 'utf-8');
  assert.ok(hist.includes(laundromat.url), 'category-rejected listing recorded');
  assert.ok(hist.includes(houston.url), 'location-rejected listing recorded');
  assert.ok(hist.includes('\trejection\t') || hist.includes('\trejection\n'), 'rejection column added to header');
  const rejA = hist.split('\n').find((l) => l.includes(laundromat.url));
  assert.ok(rejA.split('\t').length >= 8 && rejA.endsWith('category'), 'category rejection key stored');
  const rejB = hist.split('\n').find((l) => l.includes(houston.url));
  assert.ok(rejB.endsWith('location'), 'location rejection key stored');

  // Phase 2 — broader criteria: no category or location limits.
  const broad = { asking_price_range: null, sde_range: null, categories: [], locations: [], exclude_keywords: [] };
  const r2 = processListings([laundromat, houston, cheap], { dataDir: dir, filters: broad });
  assert.equal(r2.added.length, 2, 'previously rejected listings re-surface once criteria broaden');
  assert.ok(r2.added.some((l) => l.url === laundromat.url), 'category-rejected listing re-added');
  assert.ok(r2.added.some((l) => l.url === houston.url), 'location-rejected listing re-added');
  assert.ok(!r2.added.some((l) => l.url === cheap.url), 'listing already accepted in phase 1 stays a duplicate');
  const pipeline = fs.readFileSync(path.join(dir, 'pipeline.md'), 'utf-8');
  assert.ok(pipeline.includes(laundromat.url), 'formerly rejected listing lands in pipeline');
  hist = fs.readFileSync(path.join(dir, 'scan-history.tsv'), 'utf-8');
  assert.ok(!hist.split('\n').some((l) => l.includes(laundromat.url) && l.endsWith('category')), 'rejected row upgraded to accepted');

  // Phase 3 — same broad criteria again: everything is now a duplicate, nothing re-added.
  const r3 = processListings([laundromat, houston, cheap], { dataDir: dir, filters: broad });
  assert.equal(r3.added.length, 0, 'stabilized — no re-adds after history upgrade');
  const pipelineAfter = fs.readFileSync(path.join(dir, 'pipeline.md'), 'utf-8');
  assert.equal(
    (pipelineAfter.match(new RegExp(laundromat.url, 'g')) || []).length,
    1,
    'pipeline never lists the same url twice',
  );
});

test('processListings does NOT record price/exclude criteria rejections in scan-history', () => {
  const dir = setupTempDataDir();
  const cheap = { title: 'Cheap Biz', price: 50000, sde: 30000, revenue: 100000, location: 'Austin, TX', description: null, category: 'Cleaning', url: 'https://www.bizbuysell.com/opportunity/cheap-price', source: 'bizbuysell' };
  const distressed = { title: 'Distressed Cleaning', price: 450000, sde: 160000, revenue: 800000, location: 'Austin, TX', description: 'distressed sale', category: 'Cleaning', url: 'https://www.bizbuysell.com/opportunity/distressed', source: 'bizbuysell' };
  const filters = { asking_price_range: { min: 100000, max: 1000000 }, sde_range: null, categories: ['cleaning'], exclude_keywords: ['distressed'] };
  const result = processListings([cheap, distressed], { dataDir: dir, filters });
  assert.equal(result.added.length, 0);
  const hist = fs.readFileSync(path.join(dir, 'scan-history.tsv'), 'utf-8');
  assert.ok(!hist.includes(cheap.url), 'price-rejected listing not recorded (offer-driven)');
  assert.ok(!hist.includes(distressed.url), 'exclude-keyword listing not recorded (offer-driven)');
  assert.equal(hist.trim().split('\n').length, 1, 'history unchanged (header only)');
});
