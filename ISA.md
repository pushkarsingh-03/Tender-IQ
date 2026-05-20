---
task: TenderIQ tender operating system
project: TenderIQ
effort: E3
phase: observe
progress: 0.4
mode: algorithm
started: 2026-05-20
updated: 2026-05-20
---

## Problem

The current TenderIQ workspace contains a single-file HTML tracker and an Excel source, but tender records are still managed primarily through manual entry, local browser storage, and pasted email text. That makes tender history fragile, analytics shallow, and status updates dependent on manual effort rather than automatically reflecting GeM portal email notifications.

## Vision

TenderIQ becomes a reliable tender operating system: every new tender is captured once, every GeM email updates the right tender automatically, historical data stays centralized, and the dashboard answers practical business questions such as win rate, L1 gap, buyer trends, competitor frequency, pending actions, and tender pipeline health.

## Out of Scope

This first system design does not assume full browser automation into the GeM portal itself, auto-submission of tenders, or ERP-grade finance/invoicing workflows. It also does not require replacing GeM as the source of truth; the goal is a company-side intelligence and tracking layer around GeM activity.

## Constraints

- The system must preserve imported historical tender records from existing Excel data.
- Email-driven updates must be traceable to a source email so mistakes can be audited.
- Tender matching must work even when an email is incomplete, but low-confidence matches must require human approval.
- The architecture should support growth beyond a single-user localStorage app.

## Goal

Design a TenderIQ system that stores all tender records in a durable database, captures new tenders through a structured workflow, automatically ingests GeM emails to update the correct tender, and provides analytics that are useful for operational follow-up and decision-making.

## Criteria

- [ ] ISC-1: A canonical tender record schema exists for both historical imports and new tenders.
- [ ] ISC-2: The system design includes a historical migration path from `TENDER FILE.xlsx`.
- [ ] ISC-3: The system design includes a workflow for creating a new tender record at submission time.
- [ ] ISC-4: The system design includes a workflow for ingesting GeM emails automatically.
- [ ] ISC-5: The system design includes a matching strategy that links an email to the correct tender.
- [ ] ISC-6: The system design includes a confidence/approval layer for ambiguous email matches.
- [ ] ISC-7: The system design includes an append-only update history per tender.
- [ ] ISC-8: The system design includes analytics for win/loss, status distribution, and buyer trends.
- [ ] ISC-9: The system design includes analytics for pricing competitiveness such as L1 gap.
- [ ] ISC-10: The system design includes a pending-actions or alerts surface for urgent follow-up.
- [ ] ISC-11: The system design identifies the shortest viable v1 architecture.
- [ ] ISC-12: Anti: the design does not depend on browser localStorage as the primary data store.

## Test Strategy

ISC-1 | read | verify schema fields are documented | pass | Read
ISC-2 | read | verify Excel migration step exists | pass | Read
ISC-3 | read | verify new tender workflow is documented | pass | Read
ISC-4 | read | verify email ingestion workflow is documented | pass | Read
ISC-5 | read | verify match logic is documented | pass | Read
ISC-6 | read | verify confidence gate is documented | pass | Read
ISC-7 | read | verify audit timeline is documented | pass | Read
ISC-8 | read | verify analytics list includes operational metrics | pass | Read
ISC-9 | read | verify competitiveness metrics are included | pass | Read
ISC-10 | read | verify alerting/follow-up surface is included | pass | Read
ISC-11 | read | verify v1 recommendation is explicit | pass | Read
ISC-12 | read | verify localStorage is excluded as system of record | pass | Read

## Features

- Tender master database | satisfies: [ISC-1, ISC-2, ISC-12] | depends_on: [] | parallelizable: true
- New tender capture flow | satisfies: [ISC-3] | depends_on: [Tender master database] | parallelizable: true
- Email ingestion pipeline | satisfies: [ISC-4, ISC-5, ISC-6, ISC-7] | depends_on: [Tender master database] | parallelizable: true
- Analytics dashboard | satisfies: [ISC-8, ISC-9, ISC-10] | depends_on: [Tender master database, Email ingestion pipeline] | parallelizable: true
- v1 rollout plan | satisfies: [ISC-11] | depends_on: [Tender master database, Email ingestion pipeline, Analytics dashboard] | parallelizable: false
