# Query Clinic master plan

## Objective and scope

A developer reviewing a database change should be able to reproduce a slowdown, trace it to PostgreSQL plan evidence, and verify a fix on the same synthetic dataset. A portfolio visitor should be able to inspect that evidence from a static link. The first build is a TypeScript command-line benchmark and a static comparison workbench. It uses PostgreSQL through embedded PGlite to keep the experiment runnable without a daemon. Native PostgreSQL is the acceptance environment for the pull request integration.

Embedded engine reference [PGlite documentation](https://pglite.dev/docs/).

## Architecture and flow

```text
Trusted SQL fixture + candidate migration + ordered SELECT
        ↓
TypeScript runner → fresh baseline and candidate PostgreSQL instances
        ↓
Equal results? → warmup → interleaved measurements → plan extraction
        ↓
Versioned JSON report → static browser workbench
        ↓
Future native runner → GitHub Actions summary + downloadable report
```

The runner owns database lifecycle, result equality and measurement. The report owns visual comparison and never contacts a database. A run only replaces the report after both sides complete. A query failure, timeout, or changed ordered results produce a failed run. Preserve any previous report and show the process error. No product database or API is required for static artifacts.

## Database and fixture

| Item | Design |
| --- | --- |
| orders | Integer primary key, integer customer ID, timestamp, nonnegative integer total in cents |
| Distribution | 250,000 deterministic rows, one deliberately heavy customer and many smaller customers |
| Baseline | Composite index on customer ID, descending timestamp and descending ID |
| Candidate | Migration drops the composite index, preserving rows and output semantics |
| Workload | Recent orders for a small customer, stable ordering with ID tie-breaker and a 20-row limit |
| Lifecycle | Create and seed both sides from the same SQL. Analyze table statistics, apply the candidate migration only to candidate, dispose both instances at the end |
| Next workload | Add a heavy-customer case to test selectivity before introducing further joins or experiments |

For native CI use separate disposable databases with identical PostgreSQL versions and runner settings. A privileged setup role owns fixtures and migrations. A separate SELECT-only role measures queries. Avoid shared caches between independent jobs by using a fresh service per workflow.

## Benchmark and report contract

- Warm both sides and alternate measurement order across pairs. Store five measured samples per side in the initial experiment. Show median and min–max with execution time in milliseconds. Avoid summing nested buffer totals. Show root shared hits plus reads as buffer accesses when available.
- Capture a representative plan from the median sample for each side. Display operator type, relation, output rows per loop, and other metrics when present. The plans are two observed trees and do not assert cross-tree node identity.
- Store schema version, capture time, engine version, fixture row count, SQL, candidate SQL, samples, plan tree, and verified result count. In CI also record base and head SHA, fixture hash, server settings, tooling version, and runner class. Future incompatible schema changes increment the version.
- Treat sampled elapsed time as fixture evidence. Use plan shape and work counters to support diagnosis. Use identical data and setup for both sides. Compare repeated runs before adopting a blocking policy. Embedded results are not a proxy for native server or endpoint latency.

## Workbench and UX

Open directly to the comparison. Lead with query identity and the decision-relevant metric. Use a common-scale horizontal chart, then two proportional plan hierarchies with selectable steps. Put SQL and measurement details one tab away. Keep the current selection and visible focus predictable. Desktop exposes both sides together; narrow screens stack them. Include a visible benchmark-source note, keyboard-operable controls, text labels for metric changes, and an actionable load error. Use native scrolling because readers need normal keyboard, trackpad and deep-link behavior in the report.

## Security and privacy

| Boundary | Control |
| --- | --- |
| Benchmark vs developer host | Initial runner accepts fixed, trusted repository SQL only and uses disposable in-memory synthetic data. No connection strings or production database discovery. |
| Query vs fixture | Execute measurement in read-only transactions with a statement timeout. In native CI enforce least-privilege credentials plus lock and job timeouts. Treat migration SQL and any extension loading as privileged. |
| Fork vs CI credentials | For future branch benchmarking use a GitHub-hosted ephemeral runner, `pull_request`, read-only permissions, no secrets, no privileged follow-up consuming fork artifacts, and pinned actions. Never run an untrusted migration against shared infrastructure. |
| Report vs browser | Same-origin static route allowlist, content security policy, and text rendering for all report fields. No web SQL execution or remote import in this slice. |
| Artifact vs sensitive data | Publish synthetic inputs only. Native integrations can reveal constants, predicates and names in plans. Default real-repo artifacts to restricted access, document retention and perform explicit review before sharing. Omit row contents, connection strings and environment dumps. |
| Resource exhaustion | Bound native job lifetime, statement/lock time, report size and plan depth. Treat malformed future imports as untrusted and validate format and size before rendering. |

Source guidance [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use) and [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html).

## Delivery order and exit checks

1. **Local vertical slice.** One seeded schema, baseline/candidate, result parity, real samples, a built-in static report and an interaction check on desktop and mobile. Run from a clean install.
2. **Native PostgreSQL parity.** Add a native adapter and a disposable service. Verify the same ordered rows, plan differences, timeout, error cleanup and run metadata. Keep embedded mode as the portable demo.
3. **PR integration.** Check out the base and head SHA into isolated directories. Prepare each variant on the fresh native service using the same trusted fixture protocol. Produce a read-only job summary and downloadable bundle. Report differences without failing on timing alone. Verify using a baseline PR, deliberate index-drop PR and restored-index PR in the project repo.
4. **Portfolio release.** Publish the synthetic static report with a reproducible walkthrough and measured case study. Document exactly what was timed, what changed and which outcomes depend on fixture selectivity. Measure maintenance cost before expanding beyond a single manifest and local/CI ownership model.

## Operational handoff

Node.js, npm and the checked-in lockfile are sufficient for the embedded slice. Static hosting only needs the report folder. For a CI launch, budget for ephemeral compute and short artifact retention. Capture setup, measurement and rendering errors distinctly. Avoid retrying measurements invisibly. Re-run the full pair on error with a fresh fixture. Publish the commit and environment metadata with every case study.

## Implemented release

The project now includes the embedded runner, the native adapter, a revision-based PR workflow, a standalone static report, a manual Pages workflow and a case study with raw native captures. Native mode creates a unique pair of databases and restricted setup and reader roles on a dedicated loopback service. The base revision supplies the shared setup and query in PR mode. Each revision supplies only its migration. The PR workflow is informational for timing and fails on incorrect results or benchmark errors. GitHub Pages deployment is a separate default-branch workflow. See the README for the operator runbook and the case study for the captured regression and fix.
