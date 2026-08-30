import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, normalizePrice, pickUserAgent } from '../lib/scraper.mjs';

// ===== htmlToText =====

test('htmlToText strips script and style tags', () => {
  const html = `
    <html>
    <head><style>body { color: red; }</style></head>
    <body>
      <script>console.log('hi');</script>
      <p>Hello <b>World</b></p>
    </body>
    </html>`;
  const text = htmlToText(html);
  assert.ok(!text.includes('color'), 'should not include style content');
  assert.ok(!text.includes('console.log'), 'should not include script content');
  assert.ok(text.includes('Hello'), 'should include body text');
  assert.ok(text.includes('World'), 'should include bold text');
});

test('htmlToText strips HTML tags', () => {
  const html = '<div><span class="x">Price</span>: <strong>$450,000</strong></div>';
  const text = htmlToText(html);
  assert.ok(!text.includes('<'), 'should not contain any tags');
  assert.ok(!text.includes('>'), 'should not contain any tags');
  assert.ok(text.includes('Price'), 'should contain text content');
  assert.ok(text.includes('$450,000'), 'should contain price text');
});

test('htmlToText collapses whitespace', () => {
  const html = '<p>One\n\n\n   Two   </p>';
  const text = htmlToText(html);
  assert.ok(!text.includes('\n\n'), 'should collapse multiple newlines');
  assert.ok(!text.match(/  {2,}/), 'should collapse multiple spaces');
  assert.ok(text.includes('One'), 'should contain One');
  assert.ok(text.includes('Two'), 'should contain Two');
});

test('htmlToText handles empty input', () => {
  assert.equal(htmlToText(''), '');
  assert.equal(htmlToText(null), '');
  assert.equal(htmlToText(undefined), '');
});

// ===== normalizePrice =====

test('normalizePrice parses $450,000', () => {
  assert.equal(normalizePrice('$450,000'), 450000);
});

test('normalizePrice parses $450K', () => {
  assert.equal(normalizePrice('$450K'), 450000);
});

test('normalizePrice parses $450,000.00', () => {
  assert.equal(normalizePrice('$450,000.00'), 450000);
});

test('normalizePrice parses plain number 450000', () => {
  assert.equal(normalizePrice('450000'), 450000);
});

test('normalizePrice parses $1.2M', () => {
  assert.equal(normalizePrice('$1.2M'), 1200000);
});

test('normalizePrice returns null for garbage', () => {
  assert.equal(normalizePrice('N/A'), null);
  assert.equal(normalizePrice(''), null);
  assert.equal(normalizePrice(null), null);
  assert.equal(normalizePrice(undefined), null);
  assert.equal(normalizePrice('Price on request'), null);
  assert.equal(normalizePrice('Call for price'), null);
  assert.equal(normalizePrice('Not Disclosed'), null);
});

test('normalizePrice handles surrounding whitespace', () => {
  assert.equal(normalizePrice('  $450,000  '), 450000);
});

// ===== pickUserAgent =====

test('pickUserAgent returns a non-empty string with Mozilla', () => {
  const ua = pickUserAgent();
  assert.equal(typeof ua, 'string');
  assert.ok(ua.startsWith('Mozilla/5.0'));
});
