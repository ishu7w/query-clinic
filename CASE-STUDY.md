# Finding a database regression before merge

Query Clinic compares PostgreSQL execution plans across revisions using the same workload and synthetic input data. The exercise asks a practical question. Can a migration make a query much slower while every result still matches?

## Experiment

The fixture contains 250,000 orders. One customer accounts for one fifth of the rows and the workload reads the 20 most recent orders for a different customer. The baseline index starts with customer ID and then follows the requested sort order. The candidate migration drops that index. A follow-up revision restores it by removing the drop from the migration applied to a fresh database.

Each comparison creates two disposable PostgreSQL databases, verifies the same 20 ordered results, warms up both instances, and measures five pairs with alternating order. The reported times come from PostgreSQL execution counters. The runner also stores individual samples, normalizes neither timing nor buffer counts, and records the fixture hash and both tested revisions.

## What changed

| Comparison | Baseline median | Candidate median | Observed plan change |
| --- | ---: | ---: | --- |
| Drop the index | 0.042 ms | 13.874 ms | Index scan → sequential scan and sort |
| Restore the index | 11.371 ms | 0.036 ms | Sequential scan and sort → index scan |

The plan's root recorded 23 shared buffer hits with the index and 1,637 without it. The candidate still returned exactly the same rows. These captures came from local native PostgreSQL 18.7 on macOS arm64. Within-run comparisons control the fixture and machine. Across-run differences, such as 13.874 ms versus 11.371 ms for the slow side, show why individual timing thresholds should be treated cautiously.

[Regression capture](evidence/regression.json) · [Restoration capture](evidence/restored.json)

## What shipped

The GitHub Actions check compares revisions in an ephemeral PostgreSQL service and saves a downloadable report. Timing differences appear in the job summary. Query errors, mismatched results and cleanup failures fail the check. The report includes a shared time scale, inspectable plan steps, and raw JSON export.

[Reproduce the experiment](README.md)
