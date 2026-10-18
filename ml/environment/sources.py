"""Verified source registry for the environmental-covariate track.

Each entry records what was checked against the publisher on VERIFIED_AT.
Anything not confirmed is None, never guessed. See
docs/environmental-covariates.md for the full inventory and feasibility notes.
"""

VERIFIED_AT = "2026-10-18"

HDX_API = "https://data.humdata.org/api/3/action/package_show?id={dataset}"

# HDX datasets this pipeline downloads. Resources are resolved by name through
# the CKAN API so a re-upload with a new resource id is still found, and the
# upstream last_modified is written to the manifest.
HDX_DATASETS = {
    "cchain": {
        "dataset": "project-cchain",
        "publisher": "Thinking Machines Data Science (Project CCHAIN)",
        "license": "CC BY 4.0 (tm_open_buildings is ODbL; not used here)",
        "attribution": "Project CCHAIN, Thinking Machines Data Science; data via HDX",
        "resources": [
            "disease_pidsr_totals.csv",
            "climate_atmosphere.csv",
            "location.csv",
            "worldpop_population.csv",
        ],
    },
    "hdx_dengue": {
        "dataset": "philippine-dengue-cases-and-deaths",
        "publisher": "Cirrolytix (DOH Epidemiology Bureau data)",
        "license": "CC BY 4.0",
        "attribution": "DOH-EB via Cirrolytix, HDX 'Philippine Dengue Cases and Deaths'",
        "resources": ["DOH-Epi Dengue Data 2016-2021.csv"],
    },
}

# Variables taken from CCHAIN climate_atmosphere and their upstream product,
# per the HDX resource description (ERA5 for temperature/humidity, CHIRPS for
# precipitation). Units follow the CCHAIN dbdocs schema.
CLIMATE_VARIABLES = {
    "pr": {"upstream": "CHIRPS (land-only)", "unit": "mm/day", "weekly": "sum"},
    "tave": {"upstream": "ERA5", "unit": "degC", "weekly": "mean"},
    "tmin": {"upstream": "ERA5", "unit": "degC", "weekly": "mean"},
    "tmax": {"upstream": "ERA5", "unit": "degC", "weekly": "mean"},
    "rh": {"upstream": "ERA5", "unit": "%", "weekly": "mean"},
}
