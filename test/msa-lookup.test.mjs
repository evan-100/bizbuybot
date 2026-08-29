import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOP_METROS, resolveMetroStatic, resolveMetroFromNames, scanMetroNames } from '../lib/msa-lookup.mjs';

test('static table includes Orlando with correct code', () => {
  assert.deepEqual(resolveMetroStatic('Orlando, FL'), { name: 'Orlando, FL', code: '36740' });
});
test('case/punctuation-insensitive resolution', () => {
  assert.equal(resolveMetroStatic('orlando fl')?.code, '36740');
});
test('unknown metro returns null', () => {
  assert.equal(resolveMetroStatic('Atlantis, FL'), null);
});
test('state qualifier blocks cross-state city matches (Portland, TX ≠ Portland, OR)', () => {
  // TX Portland exists but is not in TOP_METROS — must return null, not Oregon.
  assert.equal(resolveMetroStatic('Portland, TX'), null);
});
test('state qualifier still resolves the matching state metro', () => {
  assert.deepEqual(resolveMetroStatic('Portland, OR'), { name: 'Portland, OR', code: '38900' });
  assert.deepEqual(resolveMetroStatic('Austin, TX'), { name: 'Austin, TX', code: '12420' });
  assert.equal(resolveMetroStatic('New York-Newark-Jersey City, NY-NJ')?.code, '35620');
});
test('inputs without a state keep prior behavior', () => {
  assert.equal(resolveMetroStatic('orlando fl')?.code, '36740');
  assert.equal(resolveMetroStatic('Portland')?.code, '38900');
});
test('empty or whitespace-only input returns null', () => {
  assert.equal(resolveMetroStatic(''), null);
  assert.equal(resolveMetroStatic('   '), null);
});
test('scanner keeps metros, drops micro areas', () => {
  const m = scanMetroNames([
    { msa: '36740', msaName: 'Orlando-Kissimmee-Sanford, FL Metro Area' },
    { msa: '10100', msaName: 'Aberdeen, SD Micro Area' },
  ]);
  assert.deepEqual([...m.keys()], ['36740']); // single key
  assert.match(m.get('36740'), /Orlando/);
});

test('dataset scan honors the state qualifier', () => {
  const names = new Map([
    ['38900', 'Portland-Vancouver-Hillsboro, OR Metro Area'],
    ['99999', 'Portland, TX Metro Area'], // hypothetical TX entry
  ]);
  assert.deepEqual(resolveMetroFromNames(names, 'Portland, TX'), { name: 'Portland, TX', code: '99999' });
  assert.deepEqual(
    resolveMetroFromNames(names, 'Portland, OR'),
    { name: 'Portland-Vancouver-Hillsboro, OR', code: '38900' },
  );
});

test('dataset scan without a state keeps prior city-prefix behavior', () => {
  const names = new Map([['36740', 'Orlando-Kissimmee-Sanford, FL Metro Area']]);
  assert.deepEqual(resolveMetroFromNames(names, 'Orlando'), { name: 'Orlando-Kissimmee-Sanford, FL', code: '36740' });
  assert.equal(resolveMetroFromNames(names, 'Atlantis'), null);
});

test('TOP_METROS exports ~30 entries as {name, code} objects', () => {
  assert.ok(Array.isArray(TOP_METROS));
  assert.ok(TOP_METROS.length >= 30 && TOP_METROS.length <= 32);
  for (const e of TOP_METROS) {
    assert.equal(typeof e.name, 'string');
    assert.equal(typeof e.code, 'string');
    assert.match(e.code, /^\d{5}$/);
  }
});
