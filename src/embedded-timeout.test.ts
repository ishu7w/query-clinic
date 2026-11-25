import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

test('stops stalled embedded setup and preserves the previous report', { timeout: 20_000 }, async () => {
  const root = new URL('../', import.meta.url);
  const workspace = await mkdtemp(new URL('.query-clinic-test-', root).pathname);
  const reportDir = join(workspace, 'report');
  const report = join(reportDir, 'data.json');
  const previous = '{"previous":true}\n';

  try {
    await Promise.all([
      cp(new URL('src/', root), join(workspace, 'src'), { recursive: true }),
      cp(new URL('fixture/', root), join(workspace, 'fixture'), { recursive: true }),
      cp(new URL('package.json', root), join(workspace, 'package.json')),
      mkdir(reportDir)
    ]);
    await writeFile(report, previous);
    await writeFile(join(workspace, 'fixture', 'setup.sql'), 'SELECT pg_sleep(20);\n');
    await assert.rejects(promisify(execFile)(process.execPath, ['src/bench.ts'], {
      cwd: workspace,
      env: { ...process.env, QUERY_CLINIC_EMBEDDED_TIMEOUT_MS: '5000' },
      timeout: 12_000
    }), (error: unknown) => {
      assert.match(String(error), /Embedded benchmark exceeded 5000 ms/);
      assert.match(String((error as { stdout?: string }).stdout), /Preparing two isolated PostgreSQL fixtures/);
      return true;
    });
    assert.equal(await readFile(report, 'utf8'), previous);
    assert.deepEqual(await readdir(reportDir), ['data.json']);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
