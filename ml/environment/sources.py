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
            "brgy_geography.csv",
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

# Canonical weekly weather variables (ENVIRONMENT tab columns). Each source
# maps its own daily column onto one of these; nothing else is renamed.
# `weekly` is how 7 daily values become one weekly value.
WEATHER_VARIABLES = {
    "precipitation_mm": {"unit": "mm/week", "weekly": "sum"},
    "temperature_mean_c": {"unit": "degC", "weekly": "mean"},
    "temperature_min_c": {"unit": "degC", "weekly": "mean of daily minima"},
    "temperature_max_c": {"unit": "degC", "weekly": "mean of daily maxima"},
    "humidity_mean_pct": {"unit": "%", "weekly": "mean"},
}

# CCHAIN climate_atmosphere daily columns and their upstream product, per the
# HDX resource description (ERA5 for temperature/humidity, CHIRPS for
# precipitation). Units follow the CCHAIN dbdocs schema.
CLIMATE_VARIABLES = {
    "pr": {"canonical": "precipitation_mm", "upstream": "CHIRPS (land-only)", "unit": "mm/day"},
    "tave": {"canonical": "temperature_mean_c", "upstream": "ERA5", "unit": "degC"},
    "tmin": {"canonical": "temperature_min_c", "upstream": "ERA5", "unit": "degC"},
    "tmax": {"canonical": "temperature_max_c", "upstream": "ERA5", "unit": "degC"},
    "rh": {"canonical": "humidity_mean_pct", "upstream": "ERA5", "unit": "%"},
}

# Open-Meteo Historical Weather API, pinned so that its series is comparable
# with CCHAIN and does not change product over time:
#   models=era5     ERA5 only. The default "best_match" blends ERA5, ERA5-Land
#                   and (from 2017) ECMWF IFS, which would put a break in the
#                   series and differ from CCHAIN's ERA5.
#   elevation=nan   no lapse-rate downscaling; CCHAIN uses raw ERA5 cells.
#   Asia/Manila     daily values over 00-23 PHT, as CCHAIN does.
# END is pinned to the last complete Sun-Sat week available when fetched, so
# a rebuild never silently picks up new days; moving it is an explicit change.
# Values within PROVISIONAL_DAYS of the retrieval date are ERA5T (preliminary,
# revised by ECMWF after about 2-3 months) and are flagged in the output.
OPEN_METEO = {
    "url": "https://archive-api.open-meteo.com/v1/archive",
    "model": "era5",
    "timezone": "Asia/Manila",
    "start": "2007-12-30",
    "end": "2026-10-10",
    "provisional_days": 92,
    "license": "CC BY 4.0 (Open-Meteo data; ERA5 Copernicus licence upstream); "
               "free API tier is non-commercial only",
    "attribution": "Weather data by Open-Meteo.com (ERA5, Copernicus Climate Change Service)",
    "variables": {
        "precipitation_sum": {"canonical": "precipitation_mm", "upstream": "ERA5"},
        "temperature_2m_mean": {"canonical": "temperature_mean_c", "upstream": "ERA5"},
        "temperature_2m_min": {"canonical": "temperature_min_c", "upstream": "ERA5"},
        "temperature_2m_max": {"canonical": "temperature_max_c", "upstream": "ERA5"},
        "relative_humidity_2m_mean": {"canonical": "humidity_mean_pct", "upstream": "ERA5"},
    },
}
