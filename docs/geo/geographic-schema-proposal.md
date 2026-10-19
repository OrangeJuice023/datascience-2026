# Geographic schema proposal (Physics 2 → Software Eng)

Status: **proposal, not yet applied.** `web/src/types/data.ts` is unchanged. The new fixture
`web/src/data/geo/hdx-reporting-units.json` carries the proposed fields as *extra* properties. It
type-checks against the current `GeographicEntity` (verified with `tsc --noEmit`, 2026-10-17), and
nothing imports it yet.

## Why the current contract is not enough

`GeographicEntity` assumes every entity is an administrative area at one `level`. The HDX dengue data
reports by **DOH reporting unit**. 22 of its "province" rows are a province **minus** the cities in it
that are reported separately. If such a row is stored as `level: "provincial"` with the province's
id, any consumer will treat it as the whole province, which undercounts it and puts the wrong value
on a province-level map.

## Proposed additions (all optional, backward-compatible)

```ts
export type GeographicEntityKind =
  /** A real administrative area (PSGC/COD-AB). */
  | "admin"
  /** A surveillance reporting unit that is not a whole admin area (e.g. province minus its HUCs). */
  | "reporting_unit";

export interface GeographicEntity {
  // …existing fields unchanged…
  kind?: GeographicEntityKind;            // default "admin"
  /** reporting_unit only: the admin entity this unit is part of. */
  partialOf?: string;
  /** reporting_unit only: ids of the units carved out of `partialOf`. */
  excludes?: string[];
  /** admin only: reporting units that sum exactly to this entity. */
  reportingUnitIds?: string[];
  /** Region used for aggregation in the source period (may differ from parentId chain; e.g. Cotabato City). */
  analysisRegionId?: string;
  /** OCHA COD-AB P-codes (one or more, for boundary-vintage unions). psgcCode stays null until PSA-verified. */
  codAbPcodes?: string[];
  /** HUC | ICC | CC for cities. */
  cityClass?: "HUC" | "ICC" | "CC";
}
```

Rules to enforce in the data layer:

1. A `HealthObservation.geographyId` may point at a `reporting_unit`. Its `geographicLevel` is then
   the level of the **reporting unit itself** (`provincial` for a remainder). The UI must show the
   entity's `name` ("Iloilo (excl. Iloilo City)"), never the name of `partialOf`.
2. **Aggregation only goes upward**, through the explicit `aggregation` maps in the fixture (or
   `reportingUnitIds`), and only for weeks where every member has a usable value. There is no API for
   splitting a value downward.
3. **Do not use `parentId` for summing.**
   - `parentId` is for display and navigation. For cities it gives the geographic province, e.g.
     Iloilo City → `iloilo`.
   - Regional sums use `analysisRegionId`. These differ for Cotabato City: its geographic province
     is Maguindanao, in BARMM today, while its 2016–2021 region is Region XII.
4. `centroid` on a reporting unit is a representative point inside the unit, for markers only.

## Ids

- Slugs follow the existing sample convention (`quezon-city`, `rizal`, `ncr`, `calabarzon`).
- Whole provinces use `<province>`; their remainders use `<province>-remainder`.
- Regions: `ilocos`, `cagayan-valley`, `central-luzon`, `calabarzon`, `mimaropa`, `bicol`,
  `western-visayas`, `central-visayas`, `eastern-visayas`, `zamboanga-peninsula`,
  `northern-mindanao`, `davao-region`, `soccsksargen`, `ncr`, `car`, `caraga`, `barmm`.
- The existing demo geographies (`src/data/sample/geographies.ts`) use the same slugs for NCR,
  CALABARZON and Rizal, so they can be swapped for the fixture without changing ids.

## Hub sheet

`data/reference/geo/geography_hub_rows.csv` uses the hub GEOGRAPHY tab's exact columns. It has 166
rows: national, 17 regions, 126 reporting units and the 22 full provinces that have remainders.
`resolution_status` is `RESOLVED` or `RESOLVED_WITH_CAVEAT` (vintage or region-change cases).
`psgc_code` is left blank until PSA verification.

## Questions for Software Eng

1. Add the optional fields to `GeographicEntity`, or keep reporting units in a separate
   `ReportingUnit` type that references entities?
2. Should the generator (`scripts/geo/build-geo.mjs`) move under `web/scripts/` next to
   `build-opendengue.mjs`, or stay top-level? It needs only Node 20 and has no npm dependencies.
3. Supabase: `geographies` table plus `geography_aggregation(parent_id, member_id, scheme)`, where
   scheme is `province`, `region` or `national`.
