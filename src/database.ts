import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export type Query = <Row extends Record<string, unknown>>(sql: string) => Promise<Row[]>;

export interface Database {
  setup(sql: string): Promise<void>;
  read<T>(run: (query: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function embedded(): Database {
  const db = new PGlite();

  return {
    setup: async sql => { await db.exec(sql); },
    read: run => db.transaction(async transaction => {
      await transaction.exec("SET TRANSACTION READ ONLY; SET LOCAL statement_timeout = '5s'");
      return run(async <Row extends Record<string, unknown>>(sql: string) => (await transaction.query<Row>(sql)).rows);
    }),
    close: () => db.close()
  };
}

export function nativeFactory(connectionString: string) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.pathname !== '/query_clinic' || !url.port || !url.username
      || url.search || url.hash) {
    throw new Error('Use a dedicated loopback PostgreSQL service, explicit port and /query_clinic database.');
  }

  const config = {
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port),
    ssl: false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    lock_timeout: 3000,
    idle_in_transaction_session_timeout: 10000
  };
  const admin = new pg.Client({
    ...config,
    database: 'query_clinic',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password)
  });

  return {
    connect: () => admin.connect(),
    close: () => admin.end(),
    async create(): Promise<Database> {
      const name = `qc_${randomBytes(8).toString('hex')}`;
      const owner = `${name}_owner`;
      const reader = `${name}_reader`;
      const ownerPassword = randomBytes(24).toString('hex');
      const readerPassword = randomBytes(24).toString('hex');
      const cleanup: Array<() => Promise<unknown>> = [];
      const setupClient = new pg.Client({ ...config, database: name, user: owner, password: ownerPassword });
      const readClient = new pg.Client({
        ...config,
        database: name,
        user: reader,
        password: readerPassword,
        statement_timeout: 5000
      });

      async function close() {
        const failures = [];
        for (const dispose of cleanup.reverse().splice(0)) {
          try {
            await dispose();
          } catch (error) {
            failures.push(error);
          }
        }
        if (failures.length) throw new AggregateError(failures, 'Disposable PostgreSQL cleanup failed.');
      }

      try {
        // All interpolated identifiers and passwords are generated from random hex.
        await admin.query(`CREATE ROLE ${owner} LOGIN PASSWORD '${ownerPassword}'`);
        cleanup.push(() => admin.query(`DROP ROLE ${owner}`));
        await admin.query(`CREATE ROLE ${reader} LOGIN PASSWORD '${readerPassword}'`);
        cleanup.push(() => admin.query(`DROP ROLE ${reader}`));
        await admin.query(`CREATE DATABASE ${name} OWNER ${owner}`);
        cleanup.push(() => admin.query(`DROP DATABASE ${name} WITH (FORCE)`));
        await admin.query(`REVOKE CONNECT, TEMPORARY ON DATABASE ${name} FROM PUBLIC;
          GRANT CONNECT ON DATABASE ${name} TO ${reader}`);
        cleanup.push(() => setupClient.end());
        await setupClient.connect();
        cleanup.push(() => readClient.end());
        await readClient.connect();

        return {
          async setup(sql) {
            await setupClient.query(sql);
            await setupClient.query(`GRANT USAGE ON SCHEMA public TO ${reader};
              GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${reader}`);
          },
          async read(run) {
            await readClient.query('BEGIN READ ONLY');
            try {
              return await run(async sql => (await readClient.query(sql)).rows);
            } finally {
              await readClient.query('ROLLBACK');
            }
          },
          close
        };
      } catch (error) {
        try {
          await close();
        } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'PostgreSQL setup and cleanup failed.');
        }
        throw error;
      }
    }
  };
}
