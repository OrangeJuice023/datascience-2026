"""Spatial analysis of the EARS signals on the 126 HDX dengue reporting units.

Implements docs/geo/spatial-assessment-and-method.md §4.2 steps 3-7 and the
§4.4 validation. Run from ml/:

    python -m spatial.run      # analysis -> data/processed/spatial/
    python -m spatial.report   # -> docs/geo/spatial-analysis-report.md + figures

Inputs are data/processed/dengue_cases_combined.xlsx and dengue_ears.xlsx
(ml/clean_dengue.py, ml/ears.py), the geography crosswalk and reporting-unit
polygons (scripts/geo/), and, for the "swap rows swapped back" check only, the
raw HDX file in data/raw/hdx_dengue/.
"""
