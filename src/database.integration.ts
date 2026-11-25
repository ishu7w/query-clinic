import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { nativeFactory } from './database.ts';

test('native benchmark uses a confined reader and removes failed fixtures', { timeout: 20000 }, async () => {
  const url = process.env.QUERY_CLINIC_DATABASE_URL;
  assert.ok(url, 'Set QUERY_CLINIC_DATABASE_URL to a dedicated local service.');
  const factory = nativeFactory(url);
  const controller = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await controller.connect();

  let instance: Awaited<ReturnType<typeof factory.create>> | undefined;
  let databaseName: string | undefined;
  let ownerName: string | undefined;
  let readerName: string | undefined;
  try {
    await factory.connect();
    instance = await factory.create();
    await instance.setup('CREATE TABLE probe (id integer); INSERT INTO probe VALUES (1);');
    const [metadata] = await instance.read(read => read<{
      database: string; reader: string; owner: string; timeout: string; permission: boolean;
    }>(`SELECT current_database() AS database, current_user AS reader,
        pg_get_userbyid(datdba) AS owner, current_setting('statement_timeout') AS timeout,
        has_table_privilege('public.probe', 'INSERT') AS permission
      FROM pg_database WHERE datname = current_database()`));

    ({ database: databaseName, reader: readerName, owner: ownerName } = metadata);
    assert.equal(metadata.permission, false);
    assert.equal(metadata.timeout, '5s');
    assert.deepEqual(await instance.read(read => read('SELECT id FROM probe')), [{ id: 1 }]);
    await assert.rejects(instance.read(read => read('INSERT INTO probe VALUES (2)')), { code: '25006' });
    await assert.rejects(instance.read(read => read('SELECT pg_sleep(6)')), { code: '57014' });
    await assert.rejects(instance.setup('SELECT missing FROM probe'), { code: '42703' });
  } finally {
    try {
      await instance?.close();
      if (databaseName && readerName && ownerName) {
        const { rows } = await controller.query(`SELECT datname AS name FROM pg_database WHERE datname = $1
          UNION ALL SELECT rolname AS name FROM pg_roles WHERE rolname IN ($2, $3)`, [databaseName, readerName, ownerName]);
        assert.deepEqual(rows, []);
      }
    } finally {
      await Promise.all([factory.close(), controller.end()]);
    }
  }
});
