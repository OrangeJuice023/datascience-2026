# SIGMA ACCESS — Data Model (planned)

> **Status: design only.** No database exists. The ACCESS page and map mode
> run on synthetic demo data (`web/src/data/demo-*.ts`) through
> `DemoAccessProvider`. This document describes the tables a future
> `SupabaseAccessProvider` would read. Nothing here implies a production
> backend, a real inventory feed or real pharmacy data.

ACCESS asks: *where are people finding or failing to find medicines and
health resources, and where might access gaps be emerging?* It is decision
support, not a medicine finder, a marketplace or a shortage declaration.

## Vocabulary and honesty rules

| Observation | SIGMA treats it as | Never as |
| --- | --- | --- |
| A search that found nothing nearby | a demand / access signal | a shortage |
| A stale inventory report | uncertainty (lower coverage) | unavailable |
| Few participating facilities | lower confidence | "the medicine does not exist here" |
| A news mention | (out of scope for ACCESS) | medicine demand |

"Shortage" is reserved for cases with sufficient independent evidence,
which SIGMA does not have today.

## Tables

TypeScript contracts: `web/src/types/access.ts`. Column names below are
snake_case equivalents.

### `medicines`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Stable slug, e.g. `oral-rehydration-salts` |
| `name` | text | Display name |
| `category` | text | Grouping for the selector; not clinical guidance |
| `is_sample` | boolean | True for demo rows |

### `facilities`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `name` | text | Real names only for facilities that have agreed to participate |
| `type` | enum | `pharmacy`, `public_hospital`, `private_hospital`, `rhu`, `health_center`, `other` |
| `area_id` | text | SIGMA geography id of the containing area |
| `psgc_code` | text null | PSA PSGC code; null until reconciled by the geography track |
| `latitude`, `longitude` | numeric | Facility location (a public place, not a person) |
| `source` | text | Onboarding channel / data-sharing agreement reference |
| `updated_at` | timestamptz | Last change to the facility record |
| `is_sample` | boolean | |

Indexes: `(area_id)`, `(psgc_code)`, `(type)`.

### `inventory_snapshots`

One report from one facility about one medicine.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | |
| `facility_id` | text FK → `facilities.id` | |
| `medicine_id` | text FK → `medicines.id` | |
| `availability` | enum | `available`, `low`, `unavailable`, `unknown` |
| `quantity_bucket` | enum null | `0`, `1-10`, `11-50`, `50+`; exact counts are not stored |
| `updated_at` | timestamptz | When the facility reported this state |
| `source` | text | Reporting channel (API, manual entry, …) |
| `recorded_at` | timestamptz | When SIGMA wrote the row |
| `is_sample` | boolean | |

Indexes: `(facility_id, medicine_id, updated_at desc)` for "latest report as
of T"; `(medicine_id, updated_at)`.

Freshness is **derived at read time**, not stored: it depends on the moment
being assessed. Prototype thresholds (`web/src/data/demo-access.ts`), not a
validated standard: under 24 h fresh, 24–72 h aging, over 72 h stale, no
report unknown.

### `medicine_search_events`

Aggregate demand input. **Non-identifying by construction.**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Random; not derived from any user or device |
| `medicine_id` | text FK → `medicines.id` | |
| `area_id` | text | Containing area only; never a precise point |
| `psgc_code` | text null | |
| `timestamp` | timestamptz | May be coarsened (e.g. to the hour) at ingest |
| `result_type` | enum | `available_found`, `not_found_nearby`, `unknown` |
| `is_sample` | boolean | |

Indexes: `(medicine_id, area_id, timestamp)`.

### `access_metrics`

Derived, one row per medicine × area × period. Recomputable from the three
tables above; stores its inputs so results can be audited.

| Column | Type | Notes |
| --- | --- | --- |
| `medicine_id`, `area_id`, `period_start`, `period_end` | composite PK | |
| `psgc_code` | text null | |
| `search_demand`, `not_found_searches` | int | Counts in the period |
| `demand_ratio` | numeric | Demand ÷ the area's early-period level |
| `facilities`, `confirmed_available`, `reported_unavailable`, `stale_inventory`, `unknown_inventory` | int | |
| `facility_coverage` | numeric | Share of facilities with a current report |
| `access_gap` | enum | `low`, `moderate`, `elevated`, `insufficient_data` |
| `confidence` | enum | `low`, `medium`, `high` |
| `reasons` | text[] | Plain-language derivation |
| `method`, `method_version` | text | Rule set that produced the row |
| `computed_at` | timestamptz | |

Relationships: `facilities 1—* inventory_snapshots *—1 medicines`;
`medicine_search_events *—1 medicines`; `access_metrics` aggregates all three
per `area_id`.

## Demo access-gap calculation

Implemented in `web/src/lib/access/metrics.ts` (`ACCESS_RULES`). Illustrative
analytical classes, **not clinically validated thresholds**.

```
coverage   = facilities with a current (fresh/aging) report ÷ facilities
available  = current reports of available or low ÷ current reports
notFound   = searches that found nothing nearby ÷ searches
demand     = searches ÷ the area's mean over the first two weeks

searches < 8                                      → low (too little demand to judge)
coverage < 0.5                                    → insufficient_data
demand ≥ 1.5 and available ≤ 1/3 and notFound ≥ 0.4 → elevated
(demand ≥ 1.2 and available < 2/3) or notFound ≥ 0.25 → moderate
otherwise                                         → low

confidence = high   if coverage ≥ 0.8 and searches ≥ 20
           = medium if coverage ≥ 0.5
           = low    otherwise
```

Poor or stale coverage lowers confidence or yields `insufficient_data`; it
never produces an `elevated` gap on its own.

## Provenance

Every snapshot and event carries `source` and `is_sample`. Metrics carry
`method`, `method_version` and `computed_at`. The UI states the source
("Demo inventory (prototype)") next to every facility value.

## Privacy

- No names, phone numbers, addresses, account ids, device ids, IP addresses,
  health records or patient information are collected or stored.
- Search location is the containing area, never a precise point.
- Individual search events are aggregated server-side; only aggregate
  metrics reach the browser (see `web/src/lib/access/load.ts`).
- Small counts may need suppression or noise before any public display
  (to be decided with a privacy review under the Data Privacy Act of 2012).

## Not implemented

Real pharmacy APIs, scraping, inventory feeds, patient data, user accounts,
payments, shortage claims and medical recommendations are out of scope.
