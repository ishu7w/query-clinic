import { appendFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { embedded, nativeFactory } from './database.ts';
import type { Database } from './database.ts';
import { median } from './metrics.ts';

interface Plan {
  'Node Type': string;
  Plans?: Plan[];
}

interface Measurement {
  Plan: Plan;
  'Execution Time': number;
}

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const native = args[0] === '--native';
const revisions = native ? args.slice(1) : args;
if ((!native && revisions.length) || (revisions.length !== 0 && revisions.length !== 2)
    || revisions.some(revision => !/^[a-f0-9]{40}$/.test(revision))) {
  throw new Error('Usage: npm run bench or npm run bench:native -- [<base SHA> <head SHA>]');
}

function atRevision(revision: string, path: string) {
  return execFileSync('git', ['show', `${revision}:${path}`], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 10000
  });
}

const [baseSha, headSha] = revisions;
const setup = baseSha ? atRevision(baseSha, 'fixture/setup.sql')
  : await readFile(new URL('fixture/setup.sql', root), 'utf8');
const query = baseSha ? atRevision(baseSha, 'fixture/order-history.sql')
  : await readFile(new URL('fixture/order-history.sql', root), 'utf8');
const baselineMigration = baseSha ? atRevision(baseSha, 'fixture/migration.sql') : '';
const candidateMigration = headSha ? atRevision(headSha, 'fixture/migration.sql')
  : await readFile(new URL('fixture/change.sql', root), 'utf8');

function describe(samples: Measurement[]) {
  const times = samples.map(sample => sample['Execution Time']);
  const midpoint = median(times);
  const representative = samples.find(sample => sample['Execution Time'] === midpoint);
  if (!representative) throw new Error('Expected a recorded median sample.');
  return { samples: times, medianMs: midpoint, plan: representative.Plan };
}

const queryRows = (db: Database) => db.read(read => read(query));
const measure = (db: Database) => db.read(async read => {
  const rows = await read<{ 'QUERY PLAN': Measurement[] }>(
    `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) ${query}`
  );
  return rows[0]['QUERY PLAN'][0];
});

const databaseUrl = process.env.QUERY_CLINIC_DATABASE_URL;
if (native && !databaseUrl) throw new Error('Set QUERY_CLINIC_DATABASE_URL for the dedicated local PostgreSQL service.');
const factory = native && databaseUrl ? nativeFactory(databaseUrl) : undefined;

async function capture() {
  const databases: Database[] = [];
  let failure: unknown;
  try {
    await factory?.connect();
    console.log('Preparing two isolated PostgreSQL fixtures…');
    const baseline = factory ? await factory.create() : embedded();
    databases.push(baseline);
    const candidate = factory ? await factory.create() : embedded();
    databases.push(candidate);
    await baseline.setup(`${setup}\n${baselineMigration}`);
    await candidate.setup(`${setup}\n${candidateMigration}`);

    const expected = await queryRows(baseline);
    const actual = await queryRows(candidate);
    if (JSON.stringify(expected) !== JSON.stringify(actual) || expected.length !== 20) {
      throw new Error('Ordered result parity failed or fixture returned an unexpected row count.');
    }

    const settings = await baseline.read(read => read<{
      version: string; shared_buffers: string; work_mem: string; max_parallel_workers_per_gather: string;
    }>(`SELECT current_setting('server_version') AS version,
        current_setting('shared_buffers') AS shared_buffers,
        current_setting('work_mem') AS work_mem,
        current_setting('max_parallel_workers_per_gather') AS max_parallel_workers_per_gather`));
    const [count] = await baseline.read(read => read<{ count: number }>('SELECT count(*)::int AS count FROM orders'));
    const [candidateCount] = await candidate.read(read => read<{ count: number }>('SELECT count(*)::int AS count FROM orders'));
    if (count.count !== candidateCount.count) throw new Error('Fixture row counts differ.');
    await measure(baseline);
    await measure(candidate);
    const before: Measurement[] = [];
    const after: Measurement[] = [];

    for (let i = 0; i < 5; i += 1) {
      // Alternate order so one side does not always run first.
      const [first, second] = i % 2 ? [candidate, baseline] : [baseline, candidate];
      const firstResult = await measure(first);
      const secondResult = await measure(second);
      before.push(i % 2 ? secondResult : firstResult);
      after.push(i % 2 ? firstResult : secondResult);
    }

    return {
      version: 1,
      capturedAt: new Date().toISOString(),
      engine: `PostgreSQL ${settings[0].version}${native ? '' : ' via PGlite'}`,
      runner: `${process.platform}/${process.arch} · Node ${process.versions.node}`,
      settings: settings[0],
      fixtureHash: createHash('sha256').update(JSON.stringify([setup, query])).digest('hex'),
      fixtureRows: count.count,
      resultRows: expected.length,
      query: query.trim(),
      change: candidateMigration.trim(),
      ...(baseSha && headSha ? { revisions: { base: baseSha, head: headSha }, baselineMigration: baselineMigration.trim() } : {}),
      baseline: describe(before),
      candidate: describe(after)
    };

  } catch (error) {
    failure = error;
    throw error;
  } finally {
    const outcomes = await Promise.allSettled(databases.map(database => database.close()));
    try {
      await factory?.close();
    } catch (error) {
      outcomes.push({ status: 'rejected', reason: error });
    }
    const errors = outcomes.flatMap(outcome => outcome.status === 'rejected' ? [outcome.reason] : []);
    if (errors.length) throw new AggregateError(failure ? [failure, ...errors] : errors, 'Benchmark cleanup failed.');
  }
}

const report = await capture();
const target = new URL('report/data.json', root);
const temporary = new URL(`report/${randomUUID()}.tmp`, root);
try {
  await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, target);
} finally {
  await rm(temporary, { force: true });
}
console.log(`Report ready · baseline ${report.baseline.medianMs} ms · candidate ${report.candidate.medianMs} ms`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, [
    '## Query Clinic benchmark', '',
    '| Baseline median | Candidate median | Result parity |',
    '| --- | --- | --- |',
    `| ${report.baseline.medianMs.toFixed(3)} ms | ${report.candidate.medianMs.toFixed(3)} ms | ${report.resultRows} ordered rows matched |`,
    '', 'Download the **query-clinic-report** artifact for both execution plans. Timing is informational.', ''
  ].join('\n'));
}
