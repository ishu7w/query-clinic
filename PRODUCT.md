# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed TypeScript, PostgreSQL, and a lightweight web report.

## Users

Developers reviewing database changes in pull requests. The first portfolio walkthrough also serves readers learning to diagnose PostgreSQL performance.

## Product purpose

Detect a query performance change, identify what PostgreSQL did differently, and reproduce the comparison against a controlled fixture.

## Operating context

Benchmarks run locally or in CI on disposable synthetic data. Reports are opened as a static web artifact. The first scenario compares a working composite index with a migration that drops it.

## Product principles

Every number has recorded provenance. Explain observed work before suggesting causes. Make the first experiment runnable from a fresh checkout.
