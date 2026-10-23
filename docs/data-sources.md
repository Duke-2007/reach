# Data sources

## Survey microdata
- **Rwanda - Integrated Household Living Conditions Survey (EICV7), 2023-2024, Cross-Sectional Sample.** National Institute of Statistics of Rwanda (NISR). NISR microdata catalog, study ID `RWA-NISR-EICV7-2023-2024-v01` (catalog number 119).
- Files received on 4 October 2026 from the NISR hackathon organisers. [TODO: add the exact download or access date and the citation text from the catalog page.]
- **Files used:** `CS_EICV7_poverty_file`, `CS_S01_S5_S7_Household`, `CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person`, `CS_S5F_access_to_services`, `CS_S9D1_Direct_Support`, `CS_S9D2_Classic_Public_Work`, `CS_S9D3_Expanded_Public_Work`, `CS_S9D4_NSDS`, `CS_S9D5_Financial_Services`, `CS_S10A1_A2_credits`, `CS_S10C_Savings`.
- **Files not used as inputs:** the expenditure and consumption files (`CS_S8*`) and other income, transfer and durables files, because poverty is defined from consumption and using them would leak the answer.

## Conditions of use (National Data Archive)
The data is used for statistical and scientific purposes only, for reporting aggregated information; no attempt is made to re-identify respondents or link to other datasets; the data is not redistributed; the source is cited; and a copy of resulting reports is sent to the National Data Archive. **This repository contains no microdata.** `data/raw/` and `data/processed/` are excluded by `.gitignore` and were never committed.

## District boundaries
- **geoBoundaries**, release type gbOpen, Rwanda ADM2 (30 districts), built 12 December 2023.
- Underlying source: Open Data Rwanda / NISR (`geodata-nisr.opendata.arcgis.com`).
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0). Credit: geoBoundaries, Open Data Rwanda / NISR.
- Used simplified geometry (`geoBoundaries-RWA-ADM2_simplified.geojson`). The 30 district names match the survey's district labels exactly.

## Published figures used for checking
National poverty 27.4% and extreme poverty 5.4% (persons), and poverty of 39.8% in 2017, from NISR EICV7 reports. The pipeline reproduces 27.4% and 5.4% from the microdata.

Routes: OSRM (FOSSGIS demo server), precomputed once; road data (c) OpenStreetMap contributors, ODbL. Optional road basemap: OpenFreeMap, OpenMapTiles, OpenStreetMap contributors.
