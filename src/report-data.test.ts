import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// @ts-expect-error The viewer uses native browser JavaScript modules.
import { readReport } from '../report/report-data.js';

const load = async () => JSON.parse(await readFile(new URL('../report/data.json', import.meta.url), 'utf8'));

test('accepts a real capture and keeps report strings as data', async () => {
  const report = await load();
  report.query = '<em>text only</em>';
  assert.deepEqual(await readReport(new Response(JSON.stringify(report))), report);
});

test('rejects bytes over the limit even without Content-Length', async () => {
  await assert.rejects(readReport(new Response(' '.repeat(512 * 1024 + 1))), /size limit/);
});

test('rejects invalid samples and excessive plan depth or node count', async () => {
  const report = await load();
  const node = { 'Node Type': 'Result' };
  const nested = Array.from({ length: 24 }).reduce(plan => ({ ...node, Plans: [plan] }), node);
  const wide = { ...node, Plans: Array.from({ length: 16 }, () => ({ ...node, Plans: Array(16).fill(node) })) };
  for (const baseline of [
    { ...report.baseline, samples: [1, 2] },
    { ...report.baseline, samples: [1, 2, 3, 4, -1] },
    { ...report.baseline, plan: nested },
    { ...report.baseline, plan: wide },
    { ...report.baseline, plan: { ...node, 'Sort Key': 'not an array' } }
  ]) {
    await assert.rejects(readReport(new Response(JSON.stringify({ ...report, baseline }))), /Invalid benchmark report/);
  }
});
