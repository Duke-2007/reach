# data/

Place the EICV7 raw files in `data/raw/`.
The folder is gitignored — **never commit microdata**.

## Expected files (Stata `.dta` format)

1. `CS_EICV7_poverty_file.dta`
2. `CS_S01_S5_S7_Household.dta`
3. `CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person.dta`
4. `CS_S5F_access_to_services.dta`
5. `CS_S9D1_Direct_Support.dta`
6. `CS_S9D2_Classic_Public_Work.dta`
7. `CS_S9D3_Expanded_Public_Work.dta`
8. `CS_S9D5_Financial_Services.dta`
9. `CS_S10A1_A2_credits.dta`
10. `CS_S10C_Savings.dta`

## Record for each file

When you add a raw file, please record in the bullet list below:

- exact file name (with extension)
- date downloaded
- NISR catalog id, URL or accession note
- any notes on the file (e.g. different column casing, expected row count)

Example:
> - `CS_EICV7_poverty_file.dta` — downloaded 2026-10-03 from https://www.statistics.gov.rw/ (catalog 119) — 15,054 households.

## Raw files inventory (to be completed)

-

## External data

`data/external/` can hold boundary shapefiles / GeoJSON (districts, sectors). Only place files here if
the licence permits redistribution; otherwise the pipeline should download them at runtime.
