# Integration audit — 2026-10-20

Cross-branch cohesion review of `OrangeJuice023/datascience-2026`, done after
`git fetch origin`. No source code was changed for this audit. Severity:
**Critical / High / Medium / Low**. "Verified" means checked in the code or by
running something. "Unverified" means it could not be checked; the reason is
given.

Companion documents: [documentation-audit.md](documentation-audit.md)
(2026-10-19 audit of `main`) and [next-steps.md](next-steps.md) (backlog).

## In plain language

`main` has not changed since 2026-10-19. The new work sits on unmerged
branches. The biggest one, `feature/sigi-mascot`, adds a JSON API, a working
Policy Copilot, the Sigi mascot and tests. However, its documentation and CI
rely on an Expo mobile app that was never committed, so the branch cannot pass
CI as it stands. The Copilot also needs access control before it is
deployed. The geography work now exists in two incompatible versions. The
dengue EARS pipeline reproduces exactly from its raw files, but still has the
swap-row defect.

## 1. Repository and synchronization status

| Ref | Commit | Notes |
| --- | --- | --- |
| `origin/main` | `8be0e89` | Unchanged since 2026-10-19 |
| `feature/sigi-mascot` | `7aedfe2` | New. 3 commits on `main`, authored "unknown" |
| PR #1 (Physics 3) | `05f4056` | Updated 2026-10-19. Branches from the older `main` `8e10632` |
| PR #3 (geography) | `077ade4` | Unchanged |
| `docs/documentation-pack` | this branch | Documentation only |

Pairwise `git merge-tree` checks: every branch merges cleanly into `main` on
its own, and PR #1, PR #3 and `feature/sigi-mascot` merge cleanly with each
other. The only textual conflict is `feature/sigi-mascot` against
`docs/documentation-pack`, in `README.md`, `docs/api.md` and `docs/mobile.md`.
Both branches add these files.

Review state of the PRs was not checked: the GitHub CLI was unavailable.

## 2. Current branches and team contributions

| Workstream | Where | State |
| --- | --- | --- |
| Dengue cleaning, DOH-style thresholds, EARS | `main` (PR #2) | Merged; not connected to the app |
| Physics 3 / CCHAIN | PR #1 (Kyla Pasion) | Unmerged. Data preparation with hash-checked manifests; **no model fitted** |
| Geography: HDX units → PSA PSGC 3Q 2026 | PR #3 (kyleflorian) | Unmerged; adds root `AGENTS.md` |
| `/api/v1`, `@sigma/contracts`, Policy Copilot, Sigi, Vitest tests, a second geography module | `feature/sigi-mascot` | Unmerged |
| Expo / React Native app, EAS configuration | **No branch or PR** | Described only in the sigi branch's `README.md` and `docs/mobile.md` |

## 3. Cross-module cohesion findings

- **Critical (verified): `feature/sigi-mascot` depends on an uncommitted
  `mobile/` folder.**
  - CI: the new `mobile` job in `.github/workflows/validate.yml` uses
    `working-directory: mobile` and `mobile/package-lock.json`, so it will fail.
  - Asset validation: `scripts/validate-sigi-assets.py` stops on the missing
    file `mobile/assets/mascot/sigi/idle.gif`.
  - Documentation: the README says "an Expo client … is in place" and links
    `web/.env.example` and `mobile/.env.example`. Neither file exists.
- **High (verified): three incompatible geography ID schemes.**

  | Track | Example ID | Source |
  | --- | --- | --- |
  | Demo data on `main` | `quezon-city` | — |
  | PR #3 | `iloilo-remainder` | PSA PSGC 3Q 2026 + COD-AB v03 |
  | `feature/sigi-mascot` `ml/geography/build.py` | `psgc:<9 digits>` | Unofficial `jgngo/psgc-data` mirror, "as-of-2017-12-31" |

  The sigi module also cites `SIGMA_SIGNAL_SPEC.md`, which does not exist,
  and writes to paths relative to the current directory.
- **Medium (verified): two Copilot endpoints with different contracts.** The
  web component `web/src/components/policy/policy-copilot.tsx` calls the older
  `/api/policy-chat`, which returns `{error}` / `{reply, model}`. The
  envelope-based `/api/v1/chat` is unused by the web app. The Groq client code
  is duplicated in `app/api/policy-chat/route.ts` and `lib/api/chat.ts`.
- **Medium (verified): documentation conflict.** On this branch,
  `docs/api.md` and `docs/mobile.md` describe `main`: no API and no mobile app.
  Once the sigi branch merges, those statements are wrong. The sigi branch's
  versions describe an app that is not committed. Reconcile them after the
  `mobile/` question is settled.
- **Low (verified): source catalogue.** `/api/v1/sources`
  (`lib/api/sources.ts`) still lists GADM, which PR #3 rules out on licence
  grounds, and Open-Meteo. It has no CCHAIN entry.

## 4. Data, modelling and scientific integrity

- **High (verified, on `main`): suspected cases↔deaths swap rows enter
  EARS.** `ml/clean_dengue.py:clean_local` keeps the 586 rows where deaths
  exceed cases (part of PR #3's 665 suspect rows) as `ok`. Not served by the
  app today. Backlog P0-1.
- **Medium (verified): wrong window in API metadata.**
  `EARS_ENGINE.dataWindow` in `web/src/lib/api/dengue.ts` (sigi branch) says
  "2016-10-01 to 2021-03-01", which misreads DD/MM dates. The actual window is
  2016-01-10 to 2021-01-03 (261 weeks, confirmed by re-running the pipeline).
- **Medium (verified): incomplete EARS description.** `EARS_LIMITATIONS` and
  the scope "126 provinces and cities" omit the swap rows and the 22
  province-remainder units.
- **What the API does correctly (verified):**
  - `/api/v1/dengue/signals` returns `not_connected` with an empty `signals`
    list (`EARS_CONNECTED = false`) and says this is not evidence of "no
    outbreak".
  - Demo signals are in a separate block with `isSample: true`.
  - The thresholds are described as "not the official DOH algorithm".
  - Missing weeks are `null`, never zero-filled.
- **The dengue sources are distinct and not joined (verified):**

  | Use | Source | Coverage | Week convention |
  | --- | --- | --- | --- |
  | API / web | OpenDengue national | 2012–2023 | Sunday (MMWR) |
  | EARS | Same national series + HDX DOH 126 units | 2016–2021 | Sunday (MMWR) |
  | Physics 3 (PR #1) | CCHAIN PIDSR, 12 cities | 2008–2022 | Monday dates |

  Keep them separate until the week convention is decided (P1-2).
- **Physics 3 (verified in code):**
  - Climate is aggregated from barangays to cities, weighted by WorldPop 2020
    population.
  - Weekly rainfall is a 7-day sum, left empty unless all 7 days exist.
    Temperature and humidity are weekly means.
  - Absent weeks and suspected reporting gaps are labelled, never imputed.
  - No model has been fitted, so no environmental feature can be called
    predictive yet. `statsmodels` is not in `ml/requirements.txt`.
  - No branch uses Open-Meteo *weather* data. The sigi branch uses only
    Open-Meteo *geocoding*, for centroids.
- **Medium (verified): Copilot context and wording.**
  - The context built in `lib/policy-chat/context.ts` includes real OpenDengue
    dates but also says "All case counts … are illustrative demo values".
  - The model receives no policy documents, so it cannot tell "no policy
    exists" from "no data".
  - When the demo data has no signal for the selected pair, the UI says "No
    signal detected", which reads as "nothing found".

## 5. API and mobile integration

- **Verified: the `/api/v1` contract.** Responses are `{data, meta}` or
  `{error, meta}`, and `meta.status` is `live`, `demo`, `unavailable` or
  `not_connected`. Defined in `packages/sigma-contracts/src/index.ts`,
  `lib/api/envelope.ts` and `lib/api/route.ts`.
- **Low (verified): contract quirks.**
  - Error responses always set `meta.status` to `"unavailable"`, even for a
    400.
  - The `disease` value is `dengue` on `/dengue/observations` but `Dengue` on
    `/dengue/signals`.
  - The body-size limit trusts the `Content-Length` header.
  - The health endpoint reports ACCESS as `"ok"`, although its data is
    simulated.
- **High before any public deployment (verified): Copilot exposure.**
  - Neither chat route has authentication or rate limiting of its own, so
    each is an open proxy to the server's `GROQ_API_KEY`.
  - `/api/policy-chat` returns up to 500 characters of the provider's error
    text, and internal exception messages, to the client.
  - The key itself stays server-side: no `NEXT_PUBLIC_` prefix, and
    `context.ts` imports `server-only`.
- **Medium (verified): no AI disclosure in the web Copilot UI.** It shows an
  "Evidence-aware" badge, and the only caveat is "not autonomous policy
  decisions". The disclosure text exists in `/api/v1/policy/info` and in the
  `limitations` of `/api/v1/chat`, but the web page uses neither.
- **Unverified (files not committed): mobile and EAS.** The sigi branch's
  `docs/mobile.md` claims:
  - EAS owner `@gervi/sigma-mobile`, a personal account.
  - The placeholder package ID `org.sigma.mobile`.
  - A `preview` profile that bakes a private LAN address
    (`http://10.60.102.14:3000/api/v1`) into the APK.
  - A public expo.dev APK link.

  Whether that APK matches any committed code cannot be determined.
- **Verified: Sigi.** It renders on the Overview page and in the Copilot,
  shows a still image when the user asks for reduced motion, and its states
  describe what the interface is doing, not what the data means.

## 6. Documentation and checklist discrepancies

- **`README.md` on `feature/sigi-mascot`:**
  - Claims an Expo client, Expo SDK 58 and EAS builds.
  - Links two missing `.env.example` files.
  - Does not mention `/api/policy-chat`, the route the web app actually uses.
- **`docs/next-steps.md` (this branch):** recommended status changes. These
  are not applied yet; update them once the team agrees.

  | Item | Recommended change | Reason |
  | --- | --- | --- |
  | P1-6 (Copilot) | NOT STARTED → IN PROGRESS | Copilot exists on `feature/sigi-mascot` |
  | P2-1 (tests) | NOT STARTED → IN PROGRESS | 57 Vitest cases on the sigi branch, none for the chat routes |
  | P2-2 (CI) | NEEDS VERIFICATION → BLOCKED | The sigi branch's `mobile` job cannot pass |
  | P1-4 (PR #1) | Stays IN PROGRESS | Add notes: rebase onto `main`; add `statsmodels` |
  | New P0 | Add | Commit `mobile/` or remove every reference to it |

## 7. Tests run and actual results

| Check | Result |
| --- | --- |
| `git fetch origin` and PR refs | OK |
| `git merge-tree`, 8 branch pairs | 7 clean; sigi + docs pack conflict in 3 files |
| `python -m compileall` on `main`, sigi and PR #1 ML code | Exit 0 (syntax only) |
| EARS pipeline re-run from the raw files in a scratch copy | **Identical** to the existing workbooks, 5 of 5 sheets |
| `scripts/validate-sigi-assets.py` | **Fails**: missing mobile asset copy |
| Web Sigi assets checked against `manifest.json` | 9/9 states OK (frames, 128×128, byte sizes, ≥ 5 distinct frames) |
| `git diff --check` | Sigi branch: 1 issue (blank line at end of file, `packages/sigma-contracts/src/index.ts:428`); others clean |
| Web lint, type-check, Vitest, build | **Not run**: Node.js was not installed on the audit machine |
| Mobile checks, PR #3 Node scripts, PR #1 full rebuild, CI results, Groq calls | Not run: no Node, no GitHub CLI, no provider key |

## 8. Prioritized recommendations

1. **Critical:** on `feature/sigi-mascot`, either commit `mobile/` (with
   `app.json`, `eas.json` and an `.env.example`, and no LAN address or
   secrets), or remove the mobile CI job, the validator's mobile parity check
   and the README claims. Re-author the commits with a real name and open a
   PR rather than pushing a local "merge into main".
2. **High:** before any deploy, retire `/api/policy-chat`, switch the web UI to
   `/api/v1/chat`, add rate limiting and access control, and show the AI
   disclosure in the UI.
3. **High:** fix the swap rows in `ml/clean_dengue.py` (P0-1) before EARS is
   connected to the app.
4. **High:** choose one geography track. PR #3 is recommended: official PSGC,
   partition-tested. Then drop `ml/geography/` or adapt it to PR #3's IDs.
5. **Medium:**
   - Correct `EARS_ENGINE.dataWindow` and `EARS_LIMITATIONS`.
   - Fix the contradictory Copilot context and the "No signal detected"
     wording.
   - Rebase PR #1 onto `main`.
   - Reconcile `README.md`, `docs/api.md` and `docs/mobile.md` across
     branches.

## 9. Safe next steps for contributors

- A local branch whose work is already in `main`, such as
  `feat/dengue-ears-pipeline` (PR #2), needs no integration. Update local
  `main` with a fast-forward only:

  ```
  git switch main
  git merge --ff-only origin/main
  ```

- Before starting new work, run `git fetch origin`, then branch from the
  updated `main`.
