# SIGMA — Policy module (ACT)

For the Policy team, Public Admin and Software Eng. Describes `main` at
`8be0e89` (2026-10-19).

## In plain language

The Policy page (`/policy`, labelled "LGU Decision Support") is a **static
demonstration**. It shows how SIGMA might turn signals into "areas for
assessment" for a local government. Every item on it is either fixed demo
text or derived from demo ACCESS data. **There is no Policy Copilot**: no AI
assistant, no question box, no API, and no database of real LGU policies.
Nothing on the page says whether any city has a dengue policy, has carried it
out, or has seen results.

## 1. Purpose and intended users

Purpose, from the page header: "Translate observed signals and analytical
findings into areas for verification and assessment. SIGMA does not
prescribe policy." Intended users: LGU and public-health staff who decide
what to verify next. These users are named in the README and
[architecture.md](architecture.md), but no user research is recorded in the
repo.

## 2. What exists today

| Part | File | Data | Real or demo |
| --- | --- | --- | --- |
| Page (Server Component) | `web/src/app/policy/page.tsx` | Calls `loadAccessBundle()` and `accessAssessments()` | — |
| View (Client Component) | `web/src/app/policy/policy-view.tsx` | Selectors for LGU and signal; renders the cards below | — |
| LGU selector | `getLocationIdsForDisease` (`web/src/data/demo-signals.ts`), `getLguById` (`web/src/data/demo-lgus.ts`) | 12 demo LGUs | Demo |
| Signal status badge | `getSignal` (`web/src/data/demo-signals.ts`) | Demo signal | Demo |
| Evidence summary | `DEMO_EVIDENCE_SUMMARY` (`web/src/data/demo-policy.ts`) | Same four bullets for every LGU | Demo |
| Areas for assessment (Surveillance, Health communication, Facility readiness, Inter-LGU coordination) | `DEMO_POLICY_INSIGHTS` | Same four cards for every LGU and disease | Demo |
| Medicine access: areas for assessment | `accessAssessments()` (`web/src/lib/access/assessments.ts`) | Latest week of `DemoAccessProvider`; first 6 non-`low` gaps; fixed review sentence per gap level | Rule-based on demo data |
| What SIGMA does not do | `SIGMA_DOES_NOT` | Fixed list | Static |

Behaviour notes (verified by reading the code):

- The evidence summary and the four assessment cards **do not change** with
  the selected LGU or disease. Only the signal badge does.
- The access list is not filtered by the selected LGU. It shows the top six
  across all demo areas.
- If the selected LGU/disease pair has no demo signal, the page shows "No
  demo data available for this combination."
- Formal OpenDengue data, EARS and DOH-threshold results are **not used** on
  this page.

## 3. Questions the module is meant to help investigate

From the page copy and the demo assessment categories: where should an LGU
verify a signal against formal surveillance, review health communication,
check facility readiness, coordinate with neighbours, or review medicine
availability? Today it can only illustrate these questions with demo data.
It cannot answer them.

## 4. Policy Copilot architecture: not implemented

| Element | Status | Evidence |
| --- | --- | --- |
| Question UI | None on `/policy`. (The Lab's "Ask the data" panel is a separate client-side mock.) | `policy-view.tsx`, `ask-data-panel.tsx` |
| Server route | None | No `web/src/app/api/` |
| System prompt | None | [prompt.md](prompt.md) |
| Context building | None | — |
| Model provider / env vars | None | `web/package.json`, no env reads besides the map variables |
| Policy evidence store | None | No policy dataset in `data/`, `web/src/data/` or the PRs |

Setup requirements today: none beyond running the web app
(`cd web && npm install && npm run dev`).

## 5. Evidence model the module needs (proposed)

A policy claim is only as good as its source. A future policy record, whether
shown directly or fed to an assistant, should keep these **five separate
claims** apart, each with its own source and date:

| Claim | Meaning | Example evidence | Must not be inferred from |
| --- | --- | --- | --- |
| Adoption | A policy, ordinance or plan formally exists | Ordinance text, resolution number, official gazette | News mentions, a model answer |
| Implementation | Activities actually carried out | LGU reports, DOH/CHD records, dated activity logs | Adoption alone |
| Funding / resources | Budget or staff allocated or spent | Annual Investment Program, COA reports, budget lines | Adoption or implementation |
| Documented outcomes | Measured results attributed to the activity | Evaluations, surveillance trends with stated method | Case declines alone (confounded by season, immunity, reporting) |
| Implementation gaps | Documented shortfalls | Audit findings, official reviews | Absence of evidence |

"No record found" is its own state, and must never be read as "not adopted".
Every record should carry `sourceIds`, `isSample` and a retrieval date, as
`Provenance` already does in `web/src/types/data.ts`. This schema is a
proposal for the Policy team to confirm ([next-steps.md](next-steps.md) P1-6).

## 6. Requirements before any assistant ships (proposed)

- An approved, versioned system prompt and evaluation set
  ([prompt.md](prompt.md) §3).
- A server-side Route Handler with input-length and history limits, rate
  limiting, and the provider key read from a server-only env var. The key
  must never use the `NEXT_PUBLIC_` prefix.
- Context built on the server from providers, with category and `isSample`
  per item. Answers must cite evidence ids and state uncertainty.
- Visible labelling of demo inputs, and a refusal path when evidence is
  missing.
- Documented in [api.md](api.md) using its endpoint template.

## 7. Privacy, security and input validation

- Today the page takes no free-text input and sends nothing to a server
  beyond normal page loads. It handles no personal data.
- ACCESS privacy rules (aggregate only, no identifiers) are in
  [access-data-model.md](access-data-model.md) and apply to anything this
  page shows from ACCESS.
- An assistant would add new risks: user questions may contain personal or
  patient information, there is a prompt-injection risk from retrieved
  documents, and key leakage is possible. Address these under the Data
  Privacy Act of 2012 before launch.

## 8. Known gaps and next steps

| Gap | Backlog |
| --- | --- |
| No decision on whether a Policy Copilot is in scope | P1-6 |
| No policy evidence dataset or schema | P1-6 |
| Page ignores the LGU selection for most content | P1-6 (content redesign) |
| Real EARS / DOH results not available to ACT | P1-3 |
| Unit labels for province remainders, once unit-level data appears | P0-2 |
| Real assistant | P3-6 |
