import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags } from '../lib/cli-flags.mjs';

test('parses --key=val into flags object', () => {
  assert.deepEqual(parseFlags(['--key=val']), { flags: { key: 'val' }, positional: [] });
});

test('parses --flag as boolean true', () => {
  assert.deepEqual(parseFlags(['--flag']), { flags: { flag: true }, positional: [] });
});

test('parses -f short flag as boolean true', () => {
  assert.deepEqual(parseFlags(['-f']), { flags: { f: true }, positional: [] });
});

test('coerces numeric --price=450000 to number', () => {
  assert.deepEqual(parseFlags(['--price=450000']), { flags: { price: 450000 }, positional: [] });
});

test('coerces float --score=4.4 to number', () => {
  assert.deepEqual(parseFlags(['--score=4.4']), { flags: { score: 4.4 }, positional: [] });
});

test('parses --key value (space-separated)', () => {
  assert.deepEqual(parseFlags(['--key', 'value']), { flags: { key: 'value' }, positional: [] });
});

test('parses space-separated numeric value as string (not coerced)', () => {
  assert.deepEqual(parseFlags(['--price', '450000']), { flags: { price: '450000' }, positional: [] });
});

test('collects positional args', () => {
  assert.deepEqual(parseFlags(['foo', 'bar']), { flags: {}, positional: ['foo', 'bar'] });
});

test('handles mixed flags and positional', () => {
  assert.deepEqual(parseFlags(['--price=450000', 'biz']), { flags: { price: 450000 }, positional: ['biz'] } );
});

test('returns empty result for no args', () => {
  assert.deepEqual(parseFlags([]), { flags: {}, positional: [] });
});
