import type { PolicyEvidenceRecord } from "@/lib/policy-evidence/types";

export const POLICY_RESEARCH_PACK = {
  id: "pa-research-2026-10",
  version: "1.0.0",
  name: "SIGMA City Evidence and Comparison Matrix + Comparative LGU Evidence and Policy Recommendations",
  ingestedOn: "2026-10-20",
  sources: [
    { id: "S-001", title: "Quezon City Local Government Annual Report July 2024-June 2025", org: "Quezon City Government" },
    { id: "S-002", title: "Quezon City Government Annual Procurement Plan FY 2024", org: "Quezon City Government / QCHD" },
    { id: "S-003", title: "Quezon City Development Thrusts and Priorities / performance targets", org: "Quezon City Government" },
    { id: "S-004", title: "Pasig City: Patuloy na Pagbaba ng Kaso ng Dengue sa Pasig, Dahil sa Sama-samang Aksyon", org: "Pasig City Government" },
    { id: "S-005", title: "Pasig City 1st Semester Procurement Monitoring Report CY2025", org: "Pasig City Government" },
    { id: "S-006", title: "Davao City Ordinance 0401-20 s.2020 and EO 15 s.2023 IRR", org: "Davao City Government" },
    { id: "S-007", title: "City gov't to barangays: Create Task Force vs dengue", org: "City Government of Davao" },
    { id: "S-008", title: "Citation tickets vs anti-mosquito borne diseases ordinance violators now ready", org: "City Government of Davao" },
    { id: "S-009", title: "Davao City 2025 dengue figure down vs 2024", org: "City Government of Davao" },
    { id: "S-010", title: "Bacolod City 2025 Resolutions: City Resolution 662", org: "Bacolod City Government" },
  ],
  limitations: [
    "Not an exhaustive census of Philippine LGUs; deeper coverage limited to reviewed cases.",
    "Many budget figures are planned/procurement plan amounts, not awards/payments/expenditures.",
    "Reported outcome declines are LGU-reported and not independently causally established.",
    "Much policy evidence is 2024-2026 while SIGMA surveillance spans ~2016-2021; do not conflate periods.",
    "Bacolod Resolution 662 full text not reviewed; only index listing.",
  ],
};

export const POLICY_EVIDENCE_RECORDS: PolicyEvidenceRecord[] = [
  {
    evidenceId: "pe-qc-annual-report-2025",
    researchPackId: POLICY_RESEARCH_PACK.id,
    researchPackVersion: POLICY_RESEARCH_PACK.version,
    locationId: "quezon-city",
    entityName: "Quezon City",
    geographicLevel: "city",
    topic: "reported_outcomes",
    claim: "QC annual report documents dengue outbreak response in February 2025; source states ~90% drop in dengue cases by April 2025 and 123 barangays cleared from outbreak status.",
    sourceTitle: "Quezon City Local Government Annual Report July 2024-June 2025",
    issuingOrganization: "Quezon City Government",
    sourceUrl: "https://quezoncity.gov.ph/wp-content/uploads/2025/12/Quezon-City-Local-Government-Annual-Report-2024-2025.pdf",
    sourceRef: "S-001",
    publicationDate: "2025-12-15",
    referencePeriod: "2024-2025",
    dateReviewed: "2026-10-19",
    evidenceType: "official_annual_report",
    verificationStatus: "verified",
    verifiedWhat: ["66 health centers provided daily free testing/consultations", "QCHIS had 693,728 registered users as of June 2025"],
    unverifiedWhat: ["Weekly case series and definition/time window for 90% decline", "Clearance criteria", "Causal attribution"],
    limitations: ["Administrative report, not independently evaluated causal impact."],
    caveats: ["Do not treat reported outcomes as proof of causality."],
    unresolvedQuestions: ["Need weekly case series, definition/time window for 90% decline, clearance criteria, intervention coverage, costs and causal evaluation."],
    notes: ["66 health centers operated daily; intensified monitoring in high-risk areas."],
    relationToSurveillancePeriod: "after_surveillance_period",
    financialStage: null,
    amount: null,
    sourceIds: ["S-001"],
  },
  {
    evidenceId: "pe-qc-app-2024",
    researchPackId: POLICY_RESEARCH_PACK.id,
    researchPackVersion: POLICY_RESEARCH_PACK.version,
    locationId: "quezon-city",
    entityName: "Quezon City",
    geographicLevel: "city",
    topic: "budget_procurement_fiscal",
    claim: "FY2024 APP lists four dengue-program vermin-abatement lines totaling PHP 3,760,000 (planned procurement), not total budget or actual expenditure.",
    sourceTitle: "Quezon City Government Annual Procurement Plan FY 2024",
    issuingOrganization: "Quezon City Government / QCHD",
    sourceUrl: "https://quezoncity.gov.ph/wp-content/uploads/2024/01/Annual-Procurement-Plan-F.Y.-2024.pdf",
    sourceRef: "S-002",
    publicationDate: "2024-01",
    referencePeriod: "FY2024",
    dateReviewed: "2026-10-19",
    evidenceType: "official_procurement_plan",
    verificationStatus: "verified",
    verifiedWhat: ["Four listed plan amounts sum to PHP 3,760,000 (Diflubenzuron 750k, Beta-cyfluthrin 650k, Etofenprox 800k, Clothianidin+Deltamethrin 1,560k)"],
    unverifiedWhat: ["Awards/POs/delivery/payment/inventory/actual use"],
    limitations: ["Not the total city dengue budget; may differ from awarded/paid amounts."],
    caveats: ["Treat as planned values only."],
    unresolvedQuestions: ["Match against PhilGEPS awards, POs, delivery/inspection, disbursement and inventory; verify quantities and actual use by barangay."],
    notes: [],
    relationToSurveillancePeriod: "after_surveillance_period",
    financialStage: "procurement_plan",
    amount: "PHP 3,760,000",
    sourceIds: ["S-002"],
  },
  {
    evidenceId: "pe-pasig-tf-2025",
    researchPackId: POLICY_RESEARCH_PACK.id,
    researchPackVersion: POLICY_RESEARCH_PACK.version,
    locationId: "pasig",
    entityName: "Pasig City",
    geographicLevel: "city",
    topic: "implementation_organizational",
    claim: "Pasig City Government announced a Dengue Task Force and community prevention package (cleanup drives, fogging/spraying, IEC, thermal fogging in clusters, hospital coordination, larvicide/ovitraps).",
    sourceTitle: "Pasig City: Patuloy na Pagbaba ng Kaso ng Dengue sa Pasig, Dahil sa Sama-samang Aksyon",
    issuingOrganization: "Pasig City Government",
    sourceUrl: "https://pasigcity.gov.ph/news-and-releases/patuloy-na-pagbaba-ng-kaso-ng-dengue-sa-pasig-dahil-sa-sama-samang-aksyon-465",
    sourceRef: "S-004",
    publicationDate: "2025-03-06",
    referencePeriod: "Prior months through March 2025",
    dateReviewed: "2026-10-19",
    evidenceType: "official_news_release",
    verificationStatus: "verified",
    verifiedWhat: ["Task force announced and interventions described"],
    unverifiedWhat: ["Formal instrument establishing task force", "Numeric threshold/SLA for fogging/escalation", "Quantified decline/time window"],
    limitations: ["Outcome stated qualitatively only; no case counts/denominators."],
    caveats: ["Qualitative decline claim not reproducible from provided text."],
    unresolvedQuestions: ["Obtain weekly case/death data, ovitrap and larvicide logs, hospital fast-lane performance, community reach and cost."],
    notes: [],
    relationToSurveillancePeriod: "after_surveillance_period",
    financialStage: null,
    amount: null,
    sourceIds: ["S-004"],
  },
  {
    evidenceId: "pe-pasig-proc-2025",
    researchPackId: POLICY_RESEARCH_PACK.id,
    researchPackVersion: POLICY_RESEARCH_PACK.version,
    locationId: "pasig",
    entityName: "Pasig City",
    geographicLevel: "city",
    topic: "budget_procurement_fiscal",
    claim: "H1 CY2025 Procurement Monitoring Report lists chemicals for Sanitation and Dengue Task Force (CHO) with amounts PHP 26,844,192.00 and PHP 26,233,312.00 in the source row; accounting interpretation requires verification.",
    sourceTitle: "Pasig City 1st Semester Procurement Monitoring Report CY2025",
    issuingOrganization: "Pasig City Government / City Health Office",
    sourceUrl: "https://assets.pasigcity.gov.ph/storage/annual_procurement_plan/2025/07/13/68737fe0c9f2c17523998401st%20Semester%20Procurement%20Monitoring%20Report%20for%20CY%202025.pdf",
    sourceRef: "S-005",
    publicationDate: "2025-07",
    referencePeriod: "H1 FY2025",
    dateReviewed: "2026-10-19",
    evidenceType: "official_procurement_monitoring",
    verificationStatus: "verified",
    verifiedWhat: ["Row identifies CHO chemicals for Sanitation and Dengue Task Force"],
    unverifiedWhat: ["Column meaning (ABC/award/obligation/payment), dengue-only share, actual spend"],
    limitations: ["Do not label as awards or actual expenditures without supporting evidence."],
    caveats: ["Amounts require reconciliation; could include shared sanitation items."],
    unresolvedQuestions: ["Review original table headers, PhilGEPS contract, PO, delivery, inspection, disbursement; separate dengue-only allocation."],
    notes: [],
    relationToSurveillancePeriod: "after_surveillance_period",
    financialStage: "unknown",
    amount: "PHP 26,844,192.00 and PHP 26,233,312.00 (row values)",
    sourceIds: ["S-005"],
  },
  {
    evidenceId: "pe-davao-ord-2020",
    researchPackId: POLICY_RESEARCH_PACK.id,
    researchPackVersion: POLICY_RESEARCH_PACK.version,
    locationId: "davao-city",
    entityName: "Davao City",
    geographicLevel: "city",
    topic: "policy_adoption_mandate",
    claim: "Ordinance No. 0401-20 s.2020 establishes Mosquito-Borne Diseases Prevention and Control Program; EO No. 15 s.2023 promulgates IRR establishing Inter-Agency Task Force and Barangay Mosquito-Borne Diseases Task Forces (4S strategies).",
    sourceTitle: "Davao City Ordinance 0401-20 implementing rules and regulations, EO No. 15 s.2023",
    issuingOrganization: "Davao City Government",
    sourceUrl: "https://www.davaocity.gov.ph/wp-content/uploads/2023/09/Signed_RCD-2023-90847_ASD092523-17-EO-25-23_compressed.pdf",
    sourceRef: "S-006",
    publicationDate: "2023-09",
    referencePeriod: "Ordinance 2020; IRR 2023",
    dateReviewed: "2026-10-19",
    evidenceType: "ordinance_ir",
    verificationStatus: "verified",
    verifiedWhat: ["Program established", "Task forces and 4S strategies named"],
    unverifiedWhat: ["Numeric alert threshold/SLA", "Budget allocation/expenditure", "Complete implementation coverage"],
    limitations: ["Existence of policy instrument does not prove complete implementation."],
    caveats: ["No SIGMA-compatible alert-to-response protocol located in reviewed excerpt."],
    unresolvedQuestions: ["Obtain budget/AIP/obligations/liquidation, task-force coverage/functionality, activity logs and linkage to response dates."],
    notes: [],
    relationToSurveillancePeriod: "after_surveillance_period",
    financialStage: null,
    amount: null,
    sourceIds: ["S-006"],
  },
  {
    evidenceId: "pe-davao-outcomes-2025",
    researchPackId: POLICY_RESEARCH_PACK.id,
    researchPackVersion: POLICY_RESEARCH_PACK.version,
    locationId: "davao-city",
    entityName: "Davao City",
    geographicLevel: "city",
    topic: "reported_outcomes",
    claim: "CHO reported 3,335 dengue cases in 2025 vs 7,157 in 2024 (53.54% decrease); earlier Week 22 report showed 1,682 vs 1,942 with 12 vs 18 deaths. Attribution not established.",
    sourceTitle: "Davao City 2025 dengue figure down vs 2024",
    issuingOrganization: "City Government of Davao",
    sourceUrl: "https://davaocity.gov.ph/health/davao-city-2025-dengue-figure-down-vs-2024/",
    sourceRef: "S-009",
    publicationDate: "2026-01-29",
    referencePeriod: "Calendar years 2024-2025",
    dateReviewed: "2026-10-19",
    evidenceType: "official_health_update",
    verificationStatus: "verified",
    verifiedWhat: ["Annual totals reported by CHO"],
    unverifiedWhat: ["Weekly/barangay series, denominators, case definition consistency, confounders, causal attribution"],
    limitations: ["Before-after comparison alone cannot establish causality."],
    caveats: ["Do not treat as proof that specific interventions caused decline."],
    unresolvedQuestions: ["Request weekly/barangay case series, deaths, denominators, task-force activity and budget; assess seasonality/confounders."],
    notes: [],
    relationToSurveillancePeriod: "after_surveillance_period",
    financialStage: null,
    amount: null,
    sourceIds: ["S-009"],
  },
  {
    evidenceId: "pe-bacolod-res662-2025",
    researchPackId: POLICY_RESEARCH_PACK.id,
    researchPackVersion: POLICY_RESEARCH_PACK.version,
    locationId: "bacolod-city",
    entityName: "Bacolod City",
    geographicLevel: "city",
    topic: "policy_adoption_mandate",
    claim: "Bacolod City 2025 resolutions index lists City Resolution 662 directing CHO and all barangays to intensify dengue and leptospirosis response; full text and implementation not reviewed.",
    sourceTitle: "Bacolod City 2025 Resolutions: City Resolution 662",
    issuingOrganization: "Bacolod City Government",
    sourceUrl: "https://bacolodcity.gov.ph/2025-resolutions/",
    sourceRef: "S-010",
    publicationDate: "2025",
    referencePeriod: "2025",
    dateReviewed: "2026-10-19",
    evidenceType: "resolutions_index",
    verificationStatus: "partially_verified",
    verifiedWhat: ["Index listing confirms Resolution 662"],
    unverifiedWhat: ["Full text, legal form/date, operative mandates, implementation, budget, outcomes"],
    limitations: ["Index listing not sufficient to confirm operative text or implementation."],
    caveats: ["Preliminary lead only; treat as unverified until full resolution obtained."],
    unresolvedQuestions: ["Obtain full resolution, implementation/accomplishment report, budget/AIP, weekly dengue data and barangay action logs."],
    notes: ["Represent as preliminary evidence lead, not established program."],
    relationToSurveillancePeriod: "after_surveillance_period",
    financialStage: null,
    amount: null,
    sourceIds: ["S-010"],
  },
  {
    evidenceId: "pe-national-lgc-1991",
    researchPackId: POLICY_RESEARCH_PACK.id,
    researchPackVersion: POLICY_RESEARCH_PACK.version,
    locationId: null,
    entityName: "Philippines (national)",
    geographicLevel: "national",
    topic: "policy_adoption_mandate",
    claim: "RA 7160 (Local Government Code of 1991) assigns local health officers responsibilities to formulate and implement health policies/plans/programs/projects and enforce public-health laws.",
    sourceTitle: "Republic Act No. 7160 (Official Gazette)",
    issuingOrganization: "Republic of the Philippines",
    sourceUrl: "https://officialgazette.gov.ph/1991/10/10/republic-act-no-7160/",
    sourceRef: "national-lgc",
    publicationDate: "1991-10-10",
    referencePeriod: "Current statutory framework",
    dateReviewed: "2026-10-19",
    evidenceType: "statute",
    verificationStatus: "verified",
    verifiedWhat: ["Statutory framework for local health responsibilities"],
    unverifiedWhat: ["How specific LGUs operationalize dengue alert-to-action"],
    limitations: ["Cross-cutting context; not city-specific evidence."],
    caveats: ["Does not establish any specific city’s dengue budget or protocol."],
    unresolvedQuestions: ["Require named owner/recipient/action/deadline/closure criteria verified against local instruments."],
    notes: ["Provides context only."],
    relationToSurveillancePeriod: "current",
    financialStage: null,
    amount: null,
    sourceIds: [],
  },
  // National dengue law and guidance, read and verified 2026-10-24 (see docs/policy-evidence-national.md for sources).
  {
    "evidenceId": "pe-national-ra11332-2019",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "surveillance_reporting",
    "claim": "RA 11332 Sec. 6 states that \"The DOH and its local counterparts are mandated to implement the mandatory reporting of notifiable diseases\" and \"shall establish and maintain functional disease surveillance and response systems\"; it names the FHSIS and the PIDSR System \"with its Case-based Surveillance and Event-based Surveillance\" in the official list of reporting systems, and requires physicians, hospitals, laboratories and other listed entities \"to accurately and immediately report notifiable diseases and health events of public health concern as issued by the DOH\".",
    "sourceTitle": "Republic Act No. 11332: Mandatory Reporting of Notifiable Diseases and Health Events of Public Health Concern Act",
    "issuingOrganization": "Congress of the Philippines",
    "sourceUrl": "https://lawphil.net/statutes/repacts/ra2019/ra_11332_2019.html",
    "sourceRef": "RA 11332, Sec. 6 (opening paragraph and paras. (a), (b), (c), (e), (f)); see also Sec. 3(k) and Sec. 4(b), (g)",
    "publicationDate": "2019-04-26",
    "referencePeriod": "Approved 26 April 2019; in force 15 days after publication (Sec. 15); publication date not verified",
    "dateReviewed": "2026-10-24",
    "evidenceType": "statute",
    "verificationStatus": "verified",
    "verifiedWhat": [
      "Full text of Secs. 1-15 read on Lawphil",
      "Sec. 6 text cross-checked against the Official Gazette enrolled-copy PDF (Internet Archive capture of 2023-10-02), printed pp. 6-8",
      "Approval date: Lawphil 'Approved: April 26, 2019'; Official Gazette page 'Signed on April 26, 2019'",
      "Sec. 6 lists FHSIS and PIDSR (case-based and event-based surveillance) as official reporting systems"
    ],
    "unverifiedWhat": [
      "Implementing Rules and Regulations: Sec. 12 required DOH to issue an IRR within 120 days; third-party listings cite a 'Revised IRR' dated 2020-08-28, but no official copy was accessed",
      "Exact publication and effectivity dates",
      "How the DOH notifiable-disease list issued under Sec. 5 classifies dengue (immediate vs weekly reporting)"
    ],
    "limitations": [
      "The Act sets duties and authority; it sets no reporting deadlines, thresholds or dengue-specific procedures (these sit in DOH issuances such as the PIDSR manual and the IRR)."
    ],
    "caveats": [
      "Approved April 2019, partway through SIGMA's 2016-2021 HDX window; earlier data were collected while Act No. 3573 (repealed by Sec. 14) applied.",
      "Lawphil is an unofficial reproduction. The live Official Gazette page returned HTTP 403; the Gazette text was read from an Internet Archive capture."
    ],
    "unresolvedQuestions": [
      "Obtain the official IRR (original and revised) from DOH and check for dengue-specific reporting rules."
    ],
    "notes": [
      "Sec. 3(k): 'public health authority' includes 'the local health office (provincial, city or municipality)'.",
      "Sec. 4(g): objective to fund 'epidemiology and surveillance units at the DOH, health facilities and local government units (LGUs)'.",
      "Sec. 9(c) prohibits 'Non-operation of the disease surveillance and response systems'; Sec. 10 sets a fine of PHP 20,000 to 50,000 and/or 1 to 6 months imprisonment."
    ],
    "relationToSurveillancePeriod": "current",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
  {
    "evidenceId": "pe-national-ra11332-2019-sec7",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "policy_adoption_mandate",
    "claim": "RA 11332 Sec. 7 gives the Secretary of Health authority \"to declare epidemics of national and/or international concerns\" (the President declares a State of Public Health Emergency where national security is threatened) and provides that \"Provincial, city or municipal health offices may only declare a disease outbreak within their respective localities\" where the declaration is supported by \"sufficient scientific evidence based on disease surveillance/data, epidemiologic investigation, environmental investigation, and laboratory investigation\".",
    "sourceTitle": "Republic Act No. 11332: Mandatory Reporting of Notifiable Diseases and Health Events of Public Health Concern Act",
    "issuingOrganization": "Congress of the Philippines",
    "sourceUrl": "https://lawphil.net/statutes/repacts/ra2019/ra_11332_2019.html",
    "sourceRef": "RA 11332, Sec. 7; definition in Sec. 3(e)",
    "publicationDate": "2019-04-26",
    "referencePeriod": "Approved 26 April 2019",
    "dateReviewed": "2026-10-24",
    "evidenceType": "statute",
    "verificationStatus": "verified",
    "verifiedWhat": [
      "Sec. 7 text read on Lawphil and in the Official Gazette enrolled-copy PDF, printed p. 8 (Internet Archive capture)",
      "Sec. 3(e) defines epidemic/outbreak as 'an occurrence of more cases of disease than normally expected within a specific place or group of people over a given period of time'"
    ],
    "unverifiedWhat": [
      "Any numeric criterion for a local outbreak declaration (the Act gives none)",
      "IRR provisions that elaborate Sec. 7"
    ],
    "limitations": [
      "Sec. 7 lists the kinds of evidence required but sets no threshold; it does not say that crossing a PIDSR alert or epidemic threshold is enough for a declaration."
    ],
    "caveats": [
      "A SIGMA 'epidemic' threshold crossing is not a legal outbreak declaration and must not be presented as one."
    ],
    "unresolvedQuestions": [
      "How the IRR and DOH guidance define 'sufficient scientific evidence' for LGU declarations, and which local declarations were made in 2016-2021."
    ],
    "notes": [
      "Relevant to how SIGMA words alerts: the declaring authority for a local outbreak is the provincial, city or municipal health office."
    ],
    "relationToSurveillancePeriod": "current",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
  {
    "evidenceId": "pe-national-ra11332-2019-sec8",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "implementation_organizational",
    "claim": "RA 11332 Sec. 8 provides that the DOH, \"in coordination with the LGUs, shall ensure that the Epidemiology and Surveillance Units (ESUs) are established and functional in all levels of the DOH and its local counterparts\", and in public and private health facilities, laboratories, ports and airports in all provinces, cities and municipalities; ESUs \"capture and verify all reported notifiable diseases\", provide epidemiologic information, conduct surveillance and response and coordinate response, and \"shall have trained required human resource complement and provision of adequate resources\".",
    "sourceTitle": "Republic Act No. 11332: Mandatory Reporting of Notifiable Diseases and Health Events of Public Health Concern Act",
    "issuingOrganization": "Congress of the Philippines",
    "sourceUrl": "https://lawphil.net/statutes/repacts/ra2019/ra_11332_2019.html",
    "sourceRef": "RA 11332, Sec. 8; funding in Sec. 11",
    "publicationDate": "2019-04-26",
    "referencePeriod": "Approved 26 April 2019",
    "dateReviewed": "2026-10-24",
    "evidenceType": "statute",
    "verificationStatus": "verified",
    "verifiedWhat": [
      "Sec. 8 text read on Lawphil and in the Official Gazette enrolled-copy PDF, printed pp. 8-9 (Internet Archive capture)",
      "Sec. 11: initial implementation charged to the DOH's current-year appropriations, thereafter to the annual General Appropriations Act"
    ],
    "unverifiedWhat": [
      "Actual ESU coverage, staffing and functionality in any LGU",
      "Funding levels actually appropriated"
    ],
    "limitations": [
      "A mandate only; whether a given province or city had a functional ESU must be checked locally."
    ],
    "caveats": [
      "The statutory mandate does not show that ESUs were functional in any SIGMA reporting unit during 2016-2021."
    ],
    "unresolvedQuestions": [
      "Obtain ESU functionality assessments by province and city for 2016-2021."
    ],
    "notes": [],
    "relationToSurveillancePeriod": "current",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
  {
    "evidenceId": "pe-national-pidsr-mop-2014-thresholds",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "surveillance_reporting",
    "claim": "PIDSR Manual of Procedures, 3rd ed., s. 5.3.5 states that, \"Concerning the national data for disease of epidemic proportions\", the alert threshold is computed as \"the weekly/monthly average of a particular disease during the past 3 to 5 years and add 1 standard deviation\" and the epidemic threshold as the average \"during the past 3 or 5 years and add 2 standard deviation\". Cases above the alert threshold \"should trigger an investigation, check epidemic preparedness and implement appropriate prevention and control measures\"; above the epidemic threshold \"an urgent response is required\".",
    "sourceTitle": "Manual of Procedures for the Philippine Integrated Disease Surveillance and Response (PIDSR), 3rd Edition, Vol. 1",
    "issuingOrganization": "National Epidemiology Center, Department of Health",
    "sourceUrl": "https://medbox.org/index.php/dl/5e148832db60a2044c2d3bf2",
    "sourceRef": "PIDSR MOP 3rd ed. (April 2014), Vol. 1, s. 5.3.5 'Interpretation of Surveillance Data' (printed pp. 57-58); s. 5.3.6 (p. 59)",
    "publicationDate": null,
    "referencePeriod": "3rd edition, dated April 2014 (no day given)",
    "dateReviewed": "2026-10-24",
    "evidenceType": "technical_manual",
    "verificationStatus": "partially_verified",
    "verifiedWhat": [
      "s. 5.3.5 read in full in a 120-page PDF whose title page reads '3rd Edition, April 2014' and cover 'VOL 1'",
      "Threshold formulas as quoted in the claim",
      "Table 5 'Recommended Thresholds for Specific Diseases' does not list dengue",
      "s. 5.3.6: 'Collaborate with specific disease reduction programs to intensify surveillance if an alert threshold has been crossed'"
    ],
    "unverifiedWhat": [
      "The copy came from a third-party library (medbox.org), not a DOH-hosted URL; that it matches the DOH-distributed edition is not confirmed",
      "Whether a later edition or DOH issuance replaces s. 5.3.5",
      "Whether DOH applies the formula to provincial or city series; the text frames it for 'national data'"
    ],
    "limitations": [
      "The front matter says: 'This document is not a formal publication of the National Epidemiology Center'."
    ],
    "caveats": [
      "SIGMA applies the formula to each of the 126 HDX reporting units with a 3-year same-week baseline. The manual states the method for national data and allows 3 to 5 years, so the per-unit use is SIGMA's adaptation.",
      "The alert wording says '3 to 5 years' and the epidemic wording '3 or 5 years'; a 3-year baseline fits both readings."
    ],
    "unresolvedQuestions": [
      "Confirm with the DOH Epidemiology Bureau whether the current PIDSR manual keeps s. 5.3.5 and how regional and provincial ESUs compute dengue thresholds."
    ],
    "notes": [
      "Confirms the citation used in ml/clean_dengue.py, ml/export_sigma_web.py and docs/dengue-pipeline.md ('PIDSR Manual of Procedures, 3rd ed., s. 5.3.5').",
      "s. 5.3.5 also lists non-epidemic reasons a trend can change: changes in the number of reporting units, the case definition, the denominator, health-seeking behaviour, and population movement."
    ],
    "relationToSurveillancePeriod": "historical",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
  {
    "evidenceId": "pe-national-pidsr-mop-2014-lgu-roles",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "implementation_organizational",
    "claim": "PIDSR Manual of Procedures, 3rd ed., s. 2.2 directs Provincial Health Offices and Municipal/City Health Offices to \"Set up and maintain a functional ... disease surveillance system\", collect and analyze surveillance data, report essential information \"immediately to the next higher level\", and maintain an epidemic preparedness and response plan; Municipal/City Health Offices \"Implement appropriate epidemic control measures immediately\". s. 4.3 sets weekly submission to the next higher level \"every Friday of the week\"; for chartered cities the city DSO submits to the regional ESU (RESU).",
    "sourceTitle": "Manual of Procedures for the Philippine Integrated Disease Surveillance and Response (PIDSR), 3rd Edition, Vol. 1",
    "issuingOrganization": "National Epidemiology Center, Department of Health",
    "sourceUrl": "https://medbox.org/index.php/dl/5e148832db60a2044c2d3bf2",
    "sourceRef": "PIDSR MOP 3rd ed. (April 2014), Vol. 1, s. 2.2.1-2.2.2 (printed pp. 16-17); s. 4.3.1-4.3.2 (pp. 33-34); s. 4.4 (p. 35)",
    "publicationDate": null,
    "referencePeriod": "3rd edition, dated April 2014 (no day given)",
    "dateReviewed": "2026-10-24",
    "evidenceType": "technical_manual",
    "verificationStatus": "partially_verified",
    "verifiedWhat": [
      "s. 2.2.1 (PHO duties a-h), s. 2.2.2 (MHO/CHO duties a-f), s. 4.3.1-4.3.2 (weekly reporting flows) and s. 4.4 (zero reporting) read",
      "Dengue is listed under 'Epidemic-Prone Diseases' (Table 1) and is not among the Category I immediately notifiable diseases listed in s. 4.2"
    ],
    "unverifiedWhat": [
      "Same provenance limit as the threshold record: third-party copy (medbox.org), not a DOH-hosted URL",
      "Whether the separate city units in the HDX DOH dataset follow the s. 4.3.2 chartered-city reporting flow"
    ],
    "limitations": [
      "Procedural manual; front matter says it is 'not a formal publication of the National Epidemiology Center'."
    ],
    "caveats": [
      "The chartered-city flow in s. 4.3.2 may help explain why some cities appear as their own reporting units in HDX data, but this is not confirmed and must not be assumed.",
      "s. 4.4 says zero reporting 'may not always indicate that there are no cases'; this supports SIGMA's rule never to treat missing or suspect weeks as zero."
    ],
    "unresolvedQuestions": [
      "Confirm with DOH-EB the reporting route for HUCs/ICCs versus component cities during 2016-2021."
    ],
    "notes": [
      "s. 2.2.1(h): PHO to 'Create Epidemic Management Committee (EMC) at the provincial level'.",
      "s. 1.3.6 defines 'silent' DRUs as those that 'have not submitted weekly notifiable disease report for 3 or more morbidity weeks'."
    ],
    "relationToSurveillancePeriod": "historical",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
  {
    "evidenceId": "pe-national-dilg-mc-2019-130",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "policy_adoption_mandate",
    "claim": "DILG MC 2019-130 (9 August 2019) states its purpose is \"to ensure that Local Government Units (LGUs) comply with the DOH's Enhanced 4S Strategy against dengue\". Sec. 4.1 \"encourages\" Local Chief Executives to implement the Enhanced 4S, activate Aksyon Barangay Kontra Dengue (MC 2012-16), synchronize the daily 4 o'clock habit, facilitate spraying and larviciding, implement the DOH \"Checklist for Dengue Epidemic Preparedness and Response\" (Annexes 1-2), keep logistics such as Oresol, NS1 RDT, larvicides and medicines available at RHUs, CHOs and LGU hospitals, and provide emergency transport for referrals.",
    "sourceTitle": "DILG Memorandum Circular No. 2019-130: Advocacy on the Prevention of Dengue and other Mosquito-Borne Diseases",
    "issuingOrganization": "Department of the Interior and Local Government",
    "sourceUrl": "https://www.dilg.gov.ph/PDF_File/issuances/memo_circulars/dilg-memocircular-201989_f9e6e9c92b.pdf",
    "sourceRef": "DILG MC 2019-130, ss. 1.0-4.4, 6.0; Annex 1 (LGU checklist) and Annex 2 (schools, RHU/CHO checklists)",
    "publicationDate": "2019-08-09",
    "referencePeriod": "2019 national dengue alert and epidemic response",
    "dateReviewed": "2026-10-24",
    "evidenceType": "memorandum_circular",
    "verificationStatus": "verified",
    "verifiedWhat": [
      "Signed, scanned 11-page PDF from dilg.gov.ph read: body pp. 1-4, schools checklist p. 5, LGU checklist pp. 7-8, RHU/CHO checklist pp. 9-11",
      "DILG issuance page lists 'Reference Number: MC2019-130', dated August 9, 2019",
      "Background cites the DOH National Dengue Alert of 15 July 2019 and the National Dengue Epidemic Declaration",
      "RHU/CHO checklist item E.3: 'Weekly analysis and reporting of cases, deaths to LCEs, Municipal/City Dengue Task Force, PESU'; item E.1 'Organized MESU/CESU'",
      "Signed by Secretary Eduardo M. Año; 'shall take effect immediately' (s. 6.0)"
    ],
    "unverifiedWhat": [
      "Compliance by any LGU",
      "Text of the DOH order that set the Enhanced 4S (not accessed)",
      "Schools checklist continuation (PDF p. 6) not read"
    ],
    "limitations": [
      "Sec. 4.1 uses 'encourages': advisory guidance, with no sanction stated."
    ],
    "caveats": [
      "Case figures in s. 1.0 are DOH figures quoted by DILG and were not checked against DOH reports.",
      "Internal date mismatch: s. 1.0 says the National Dengue Epidemic Declaration was issued on August 6, 2019; s. 5.2 lists it as 'dated 05 August 2019'.",
      "The DILG page title spells 'Denque'; the PDF title reads 'Dengue'."
    ],
    "unresolvedQuestions": [
      "Obtain the LGU activity reports consolidated by DRRM Offices under s. 4.4 for 2019."
    ],
    "notes": [
      "Issued inside SIGMA's 2016-2021 HDX window, during the 2019 epidemic year.",
      "s. 1.0 describes the 4th S as 'say Yes to fogging only in hotspot areas where case increase is registered for two consecutive weeks'.",
      "s. 1.0: the Secretary of Health ordered that 'clustering of cases must be done by the respective DOH regional offices and shall serve as basis for the declaration of a localized epidemic at the barangay level'.",
      "s. 4.4: activities documented and reported to the Municipal, City, Provincial and Regional DRRM Offices, with a copy of the regional report to the DOH and DILG Regional Offices."
    ],
    "relationToSurveillancePeriod": "historical",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
  {
    "evidenceId": "pe-national-dilg-mc-2019-130-ldrrmf",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "budget_procurement_fiscal",
    "claim": "DILG MC 2019-130 s. 4.2 states that LGUs \"may utilize part of the seventy percent (70%) allocation for disaster preparedness and part of the thirty percent (30%) quick response fund from the Local Disaster Risk Reduction and Management Fund (LDRRMF), subject to the usual accounting and auditing rules and regulations\", in accordance with NDRRMC-DBM-DILG Joint Memorandum Circular No. 2013-1 dated 25 March 2013.",
    "sourceTitle": "DILG Memorandum Circular No. 2019-130: Advocacy on the Prevention of Dengue and other Mosquito-Borne Diseases",
    "issuingOrganization": "Department of the Interior and Local Government",
    "sourceUrl": "https://www.dilg.gov.ph/PDF_File/issuances/memo_circulars/dilg-memocircular-201989_f9e6e9c92b.pdf",
    "sourceRef": "DILG MC 2019-130, s. 4.2",
    "publicationDate": "2019-08-09",
    "referencePeriod": "2019",
    "dateReviewed": "2026-10-24",
    "evidenceType": "memorandum_circular",
    "verificationStatus": "verified",
    "verifiedWhat": [
      "s. 4.2 text read in the signed PDF (p. 3)"
    ],
    "unverifiedWhat": [
      "Whether any LGU used LDRRMF for dengue in 2019, and how much",
      "Text of NDRRMC-DBM-DILG JMC No. 2013-1"
    ],
    "limitations": [
      "Permissive ('may'): it names an allowed funding source; it is not an appropriation, allocation or expenditure."
    ],
    "caveats": [
      "Do not treat this as evidence of actual LDRRMF spending on dengue."
    ],
    "unresolvedQuestions": [
      "Match against LGU LDRRMF utilization reports or COA audit reports for 2019."
    ],
    "notes": [],
    "relationToSurveillancePeriod": "historical",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
  {
    "evidenceId": "pe-national-dilg-mc-2025-011",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "policy_adoption_mandate",
    "claim": "DILG MC 2025-011 (24 February 2025) cites a DOH report of 17 February 2025 of rising dengue cases in nine LGUs, including an outbreak declaration in Quezon City. Sec. 4.1 encourages LCEs to mobilize local health units and volunteers for clean-up drives, search-and-destroy operations and declogging; s. 4.2 reminds LGUs to adhere to DILG MCs 2019-176, 2019-130, 2016-31 and 2012-016; s. 4.4 states \"The LGUs shall allocate sufficient financial and logistical resources for dengue control activities\", including larvicides, insecticides and vector-control equipment; s. 5.1 directs DILG Regional Offices to monitor LGU compliance.",
    "sourceTitle": "DILG Memorandum Circular No. 2025-011: Strengthening Local Government Actions for Dengue Prevention and Control",
    "issuingOrganization": "Department of the Interior and Local Government",
    "sourceUrl": "https://www.dilg.gov.ph/PDF_File/issuances/memo_circulars/dilg-memocircular-2025224_45c21fce86.pdf",
    "sourceRef": "DILG MC 2025-011, ss. 1.0-5.1, 6.0",
    "publicationDate": "2025-02-24",
    "referencePeriod": "2025",
    "dateReviewed": "2026-10-24",
    "evidenceType": "memorandum_circular",
    "verificationStatus": "verified",
    "verifiedWhat": [
      "Signed, scanned 3-page PDF from dilg.gov.ph read in full",
      "DILG issuance page lists 'Reference Number: MC No 2025-011', dated February 24, 2025",
      "Signed by Secretary Juanito Victor C. Remulla; 'shall take effect immediately' (s. 6.0)"
    ],
    "unverifiedWhat": [
      "LGU compliance and the results of the s. 5.1.2 monitoring form",
      "Any actual allocation made under s. 4.4"
    ],
    "limitations": [
      "A 2025 instrument; it post-dates SIGMA's 2016-2021 surveillance data."
    ],
    "caveats": [
      "Page footers read 'Page 2 of 4' then 'Page 3 of 3'. Content runs on from s. 4.3 to s. 4.4, but a missing page cannot be fully ruled out.",
      "s. 4.4 'shall allocate' is a directive without amounts; it is not budget evidence."
    ],
    "unresolvedQuestions": [
      "Obtain the DILG Regional Office monitoring results under s. 5.1."
    ],
    "notes": [
      "s. 4.3 encourages information on prevention, symptom recognition and early consultation; s. 4.5 encourages coordination with DOH and DPWH."
    ],
    "relationToSurveillancePeriod": "after_surveillance_period",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
  {
    "evidenceId": "pe-national-ra11223-2019",
    "researchPackId": "sigma-national-policy-2026-10",
    "researchPackVersion": "0.1.0",
    "locationId": null,
    "entityName": "Philippines (national)",
    "geographicLevel": "national",
    "topic": "implementation_organizational",
    "claim": "RA 11223 (Universal Health Care Act) Sec. 17 provides that the DOH \"shall endeavor to contract province-wide and city-wide health systems for the delivery of population-based health services\", which \"shall have the following minimum components\", including \"(b) Accurate, sensitive, and timely epidemiologic surveillance systems\"; Sec. 4(q) defines population-based health services as interventions \"such as health promotion, disease surveillance, and vector control\".",
    "sourceTitle": "Republic Act No. 11223: Universal Health Care Act",
    "issuingOrganization": "Congress of the Philippines",
    "sourceUrl": "https://lawphil.net/statutes/repacts/ra2019/ra_11223_2019.html",
    "sourceRef": "RA 11223, Sec. 17(b) and Sec. 4(q); see also Secs. 19-20",
    "publicationDate": "2019-02-20",
    "referencePeriod": "Approved 20 February 2019",
    "dateReviewed": "2026-10-24",
    "evidenceType": "statute",
    "verificationStatus": "verified",
    "verifiedWhat": [
      "Sec. 4(q), 17, 19 and 20 text read on Lawphil; section list checked",
      "Approval date 'Approved: February 20, 2019' (Lawphil)"
    ],
    "unverifiedWhat": [
      "Official Gazette copy not cross-checked",
      "UHC IRR provisions on surveillance",
      "Which provinces and cities had integrated health systems during 2016-2021"
    ],
    "limitations": [
      "Sec. 17 uses 'shall endeavor to contract': surveillance is a minimum component of contracted health systems, not a standalone LGU duty."
    ],
    "caveats": [
      "Sec. 30 (Health Promotion) was checked and is not about surveillance; the surveillance provision is Sec. 17(b).",
      "Enacted February 2019; province-wide and city-wide integration post-dates most of SIGMA's 2016-2021 data."
    ],
    "unresolvedQuestions": [
      "Check the UHC IRR and DOH guidance for surveillance standards of province-wide and city-wide health systems."
    ],
    "notes": [
      "Sec. 19: Provincial and City Health Boards oversee integration; city-wide systems apply to highly urbanized and independent component cities.",
      "Sec. 20: a Special Health Fund pools resources for population-based and individual-based services."
    ],
    "relationToSurveillancePeriod": "current",
    "financialStage": null,
    "amount": null,
    "sourceIds": []
  },
];

export function getPolicyEvidenceByLocation(locationId: string) {
  return POLICY_EVIDENCE_RECORDS.filter((r) => r.locationId === locationId);
}

export function getAllPolicyEvidence() {
  return POLICY_EVIDENCE_RECORDS;
}
