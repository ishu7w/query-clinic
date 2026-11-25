# Query Clinic

Query Clinic compares PostgreSQL query performance across revisions of a fixture. It checks ordered result parity, records the observed plans and produces a static report with a shared time scale and selectable operators.

[Live interactive demo](https://ishu7w.github.io/query-clinic/) · [Case study and measured results](CASE-STUDY.md) · [Architecture and security plan](MASTER-PLAN.md)

## Open the report

Requires Node.js 22.18 or newer.

```sh
npm ci --ignore-scripts
npm run dev
```

Open [the report](http://127.0.0.1:4173). The included capture is from a real native PostgreSQL run. Use `npm run bench` to generate a replacement capture with the bundled in-memory PGlite runner. Use `npm test` for the unit and TypeScript checks.

## Run native PostgreSQL locally

Start a dedicated disposable server on loopback. For example, with Docker:

```sh
docker run --rm -d --name query-clinic-pg \
  -p 127.0.0.1:55482:5432 \
  -e POSTGRES_DB=query_clinic \
  -e POSTGRES_PASSWORD=query-clinic-ephemeral \
  postgres:18-bookworm

docker exec query-clinic-pg pg_isready -U postgres -d query_clinic

export QUERY_CLINIC_DATABASE_URL='postgresql://postgres:query-clinic-ephemeral@127.0.0.1:55482/query_clinic'
npm run test:native
npm run bench:native
docker stop query-clinic-pg
```

Wait for `pg_isready` to report that the server is accepting connections. The controller needs database and role creation privileges on this dedicated service. Each side gets its own database and setup login. A separate SELECT-only login runs the workload in read-only transactions. The runner closes clients and removes both databases and their roles after the run. Keep local SQL inputs trusted and use synthetic data.

## Run against a pull request

1. Add the project to a GitHub repository with Actions enabled. Keep the synthetic fixture and benchmark query in the base branch.
2. Open a branch that adds `DROP INDEX orders_customer_history_idx;` to `fixture/migration.sql`. Open a PR. The workflow compares the PR base commit with GitHub’s proposed merge commit. It uses the base revision's shared setup and query, and checks that the full orders data matches after applying each migration.
3. Open **Actions → Query Clinic**. The job summary shows the medians and result check. Use the Actions summary for a quick comparison. For the interactive view, download only `data.json` from **query-clinic-report**, copy that file into `report/` in a separate, trusted default-branch checkout, and run `npm run dev` there. Treat PR output as untrusted data. Keep the viewer and all executable files from the trusted checkout.
4. Restore the index by removing the drop in a follow-up change. A local comparison can also use `npm run bench:native -- <base-SHA> <head-SHA>` with two full SHAs. To see the restoration directly, use the slow commit as the base and the restored commit as the head.

The check reports timing differences without gating merges on a noisy sample. Database errors, changed fixture data, and result mismatches fail the job. The PR workflow uses read-only repository permissions and a disposable service and receives no application secrets. Keep CI on GitHub-hosted runners.

## Publish the portfolio report

The `report/` folder works on a static host. For GitHub Pages, restrict the `github-pages` environment to the exact default branch (branch rule only), choose **GitHub Actions** under repository **Settings → Pages**, and dispatch **Publish Query Clinic report** on the default branch. The deployment uploads the committed synthetic capture. Review the JSON as well as the visible report before publishing, since PostgreSQL plans can contain SQL literals and object names.

The evidence folder contains two native captures from GitHub Actions. Run `git fetch --tags` to retrieve the exact tested merge commits, then pass the two SHAs from the desired capture to the native CLI.
