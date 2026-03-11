# Testing and Quality Gates

## Commands
- Run contract checks:
  - `clarinet check`
- Run unit tests:
  - `npm run test`
- Run tests with coverage and cost reports:
  - `npm run test:report`

## Report Artifacts
After `npm run test:report`, the following files are generated in the project root:
- `lcov.info` (coverage data)
- `costs-reports.json` (execution cost report)

## Current Baseline
- Contract checks pass.
- Unit tests pass (`18/18`).
- Coverage and cost artifacts are produced successfully.

## Phase 3 Gate Criteria
A change is considered Phase-3-safe when all conditions below hold:
- `clarinet check` passes.
- `npm run test` passes.
- `npm run test:report` passes and regenerates `lcov.info` and `costs-reports.json`.
- New mutable contract logic includes at least one happy-path and one failure-path test.

## Notes
- Warnings shown from required sBTC contracts under `.cache/requirements` are upstream dependency warnings and do not block this project's checks.
- The Vitest `transformMode` deprecation warning comes from the Clarinet test environment integration and is non-blocking for now.
