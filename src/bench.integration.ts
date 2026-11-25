import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);

test('native CLI finds the index drop and rejects changed fixture data', { timeout: 60000 }, async () => {
  const root = new URL('../', import.meta.url);
  const workspace = await mkdtemp(fileURLToPath(new URL('.query-clinic-test-', root)));
  const output = join(workspace, 'report', 'data.json');
  const launch = () => execute(process.execPath, ['src/bench.ts', '--native'], {
    cwd: workspace,
    env: { ...process.env, GITHUB_STEP_SUMMARY: '' },
    timeout: 25000
  });

  try {
    await Promise.all([
      cp(new URL('src/', root), join(workspace, 'src'), { recursive: true }),
      cp(new URL('fixture/', root), join(workspace, 'fixture'), { recursive: true }),
      cp(new URL('package.json', root), join(workspace, 'package.json')),
      mkdir(join(workspace, 'report'))
    ]);

    await launch();
    const original = await readFile(output, 'utf8');
    const report = JSON.parse(original);
    assert.equal(report.fixtureRows, 250000);
    assert.equal(report.resultRows, 20);
    assert.match(report.fixtureDataHash, /^[a-f0-9]{64}$/);
    assert.match(JSON.stringify(report.baseline.plan), /"Index Name":"orders_customer_history_idx"/);
    assert.doesNotMatch(JSON.stringify(report.candidate.plan), /"Index Name":"orders_customer_history_idx"/);
    assert.match(JSON.stringify(report.candidate.plan), /"Node Type":"Seq Scan"/);

    await writeFile(join(workspace, 'fixture', 'change.sql'),
      'UPDATE orders SET customer_id = 9000 WHERE id = 5;\n');
    await assert.rejects(launch(), error => {
      assert.match(String(error), /Fixture data differs after migrations/);
      return true;
    });
    assert.equal(await readFile(output, 'utf8'), original);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
