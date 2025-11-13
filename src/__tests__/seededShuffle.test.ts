import { seededShuffle } from '../utils/seededShuffle';
import { test, expect } from 'vitest';

function ids(arr: any[]) { return arr.map((x) => x.id); }

test('seededShuffle is deterministic', () => {
  const arr = [{id:1},{id:2},{id:3},{id:4},{id:5},{id:6}];
  const a = seededShuffle(arr, 12345);
  const b = seededShuffle(arr, 12345);
  expect(ids(a)).toEqual(ids(b));
});

test('seededShuffle changes order for different seeds', () => {
  const arr = [{id:1},{id:2},{id:3},{id:4},{id:5},{id:6}];
  const a = seededShuffle(arr, 1);
  const b = seededShuffle(arr, 2);
  expect(ids(a)).not.toEqual(ids(b));
});
