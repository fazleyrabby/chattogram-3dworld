# Chattogram 3D World — Documentation

Running engineering record for the project. The product/design source of truth is
[`../spec.md`](../spec.md); this folder records **decisions, data research, and
per-milestone progress**.

## Structure

| File | Purpose |
| --- | --- |
| [`decisions.md`](decisions.md) | Architecture Decision Records (ADRs) — stack, formats, projections |
| [`data-sources.md`](data-sources.md) | Verified data sources, licenses, and counts for Chattogram |
| [`progress.md`](progress.md) | Milestone tracker + verification status |
| [`milestones/`](milestones/) | One document per milestone with scope and outcome |
| [`log/`](log/) | Chronological step-by-step build log |

## Conventions

- One ADR per significant technical choice, with rationale and alternatives.
- Each milestone gets a document; mark status as `planned`, `in progress`, or `done`.
- Every step that changes the codebase adds an entry to the day's log.
- Verified facts (counts, URLs, tool versions) live in `data-sources.md`, not in code comments.
