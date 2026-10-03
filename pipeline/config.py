from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DATA_RAW = ROOT / "data" / "raw"
DATA_EXTERNAL = ROOT / "data" / "external"
DATA_PROCESSED = ROOT / "data" / "processed"
OUTPUTS = ROOT / "outputs"
APP_PUBLIC_DATA = ROOT / "app" / "public" / "data"
DOCS = ROOT / "docs"

RANDOM_SEED = 42

POVERTY_FILE = "CS_EICV7_poverty_file"

RAW_FILES = [
    "CS_EICV7_poverty_file",
    "CS_S01_S5_S7_Household",
    "CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person",
    "CS_S5F_access_to_services",
    "CS_S9D1_Direct_Support",
    "CS_S9D2_Classic_Public_Work",
    "CS_S9D3_Expanded_Public_Work",
    "CS_S9D5_Financial_Services",
    "CS_S10A1_A2_credits",
    "CS_S10C_Savings",
]

RAW_FILES_NOTE = (
    "File stem list only — do not assume the on-disk format. The actual files on the NISR "
    "catalog may be delivered as .dta, .sav, .csv, .zip of multiple files, or something "
    "else. 01_load_clean.py must resolve each stem to the real path(s) after inspection "
    "(see docs/data-notes.md and data/README.md inventory)."
)

ID_COLUMNS = ["hhid"]
WEIGHT_COLUMN = "weight"
CLUSTER_COLUMN = "clust"
STRATA_COLUMN = None
POVERTY_COLUMN = None
EXTREME_POVERTY_COLUMN = None
DISTRICT_COLUMN = "district"

HOUSEHOLD_FEATURES = []
PERSON_AGG_FEATURES = []

SUPPORT_COLUMNS = []
FINANCIAL_INCLUSION_COLUMNS = []

MIN_CELL_SIZE = 30
