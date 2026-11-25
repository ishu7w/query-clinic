# Finding a database regression before merge

Query Clinic compares PostgreSQL execution plans across revisions using the same workload and synthetic input data. The exercise asks a practical question. Can a migration make a query much slower while every result still matches?

## Experiment

The fixture contains 250,000 orders. One customer accounts for one fifth of the rows and the workload reads the 20 most recent orders for a different customer. The baseline index starts with customer ID and then follows the requested sort order. The candidate migration drops that index. A follow-up revision restores it by removing the drop from the migration applied to a fresh database.

Each comparison creates two disposable PostgreSQL databases, verifies the same 20 ordered results, warms up both instances, and measures five pairs with alternating order. The reported times come from PostgreSQL execution counters. The runner also stores individual samples, normalizes neither timing nor buffer counts, and records the fixture hash and both tested revisions.

## What changed

| Comparison | Baseline median | Candidate median | Observed plan change |
| --- | ---: | ---: | --- |
| Drop the index | 0.038 ms | 7.746 ms | Index scan → sequential scan and sort |
| Restore the index | 5.578 ms | 0.021 ms | Sequential scan and sort → index scan |

In the regression run, the plan’s root recorded 23 shared buffer hits with the index and 1,637 without it. Both runs returned the same 20 ordered rows and recorded the same fingerprint for all 250,000 orders. GitHub Actions ran the captures on PostgreSQL 18.7 (Debian 18.7-1.pgdg12+5). Compare times within a run, since separate hosted machines may have different load and cache behavior.

- [Index-drop PR](https://github.com/ishu7w/query-clinic/pull/1) · [Actions run](https://github.com/ishu7w/query-clinic/actions/runs/45591698502) · [Captured report](evidence/regression.json)
- [Index-restoration PR](https://github.com/ishu7w/query-clinic/pull/2) · [Actions run](https://github.com/ishu7w/query-clinic/actions/runs/45591704014) · [Captured report](evidence/restored.json)

The tested merge commits are retained as the `demo-regression` and `demo-restoration` tags. Fetch tags before replaying the exact SHAs in the captures.

## What shipped

The GitHub Actions check compares revisions in an ephemeral PostgreSQL service and saves a downloadable report. Timing differences appear in the job summary. Query errors, mismatched results and cleanup failures fail the check. The report includes a shared time scale, inspectable plan steps, and raw JSON export.

[Reproduce the experiment](README.md)
