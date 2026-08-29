import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLocalToday } from '../lib/local-today.mjs';

test('zero-pads month: Aug 5 2026 -> 2026-08-05', () => {
  assert.equal(getLocalToday(new Date(2026, 7, 5)), '2026-08-05');
});

test('zero-pads day: Nov 22 2026 -> 2026-11-22', () => {
  assert.equal(getLocalToday(new Date(2026, 10, 22)), '2026-11-22');
});

test('zero-pads both month and day: Jan 3 2026 -> 2026-01-03', () => {
  assert.equal(getLocalToday(new Date(2026, 0, 3)), '2026-01-03');
});

test('no-arg call returns YYYY-MM-DD format string', () => {
  const result = getLocalToday();
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});
