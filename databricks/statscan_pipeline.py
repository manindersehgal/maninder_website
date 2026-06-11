# Databricks notebook source
# Paste this file into a Databricks notebook (File → Import → this .py file)
# OR create a new notebook and copy cell-by-cell using the COMMAND separators below.
#
# Schedule: Databricks Jobs → Create Job → Weekly, Monday 07:00 MT (13:00 UTC)
#
# One-time setup:
#   1. Create a Databricks secret scope called "website":
#        databricks secrets create-scope --scope website
#        databricks secrets put --scope website --key blob-conn-string
#      Paste your Azure Blob Storage connection string when prompted.
#
#   2. Create an Azure Blob Storage container called "website-data"
#      with Blob-level public read access (allows the website to read the JSON).
#
#   3. Set DELTA_TABLE_PATH below to a path on your DBFS mount or Unity Catalog volume.
#
#   4. Install azure-storage-blob on your cluster:
#      Cluster → Libraries → Install New → PyPI → azure-storage-blob

# COMMAND ----------

import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType, TimestampType
)
from delta.tables import DeltaTable

# ─── Configuration ────────────────────────────────────────────────────────────
BLOB_CONNECTION_STRING = dbutils.secrets.get(scope="website", key="blob-conn-string")
BLOB_CONTAINER         = "website-data"
BLOB_FILE              = "statscan_data.json"

# Change this to your DBFS mount or Unity Catalog path
DELTA_TABLE_PATH = "dbfs:/mnt/website-data/statscan_history"

WDS_BASE = "https://www150.statcan.gc.ca/t1/wds/rest"

# Vector IDs confirmed from Alberta Government WDS notebook.
# Format: series_name → (vector_id, latest_n_periods, unit)
CONFIRMED_VECTORS = {
    "unemployment": (2062815, 60, "%"),   # Canada unemployment rate, both sexes, 15+
}

# Coordinate-based series for tables without confirmed vector IDs.
# Format: series_name → (product_id, coordinate, latest_n_periods, unit)
# Run the Coordinate Discovery section below to verify or update these coordinates.
COORD_SERIES = {
    "gdp":                 (36100104, "1.1.1.1", 40, "Billions CAD (Chained 2012$)"),
    "cpi":                 (18100004, "1.1",     60, "Index (2002=100)"),
    "labour_productivity": (36100480, "1.1",     40, "Index (2012=100)"),
    "housing_starts":      (34100143, "1.1",     60, "Units"),
    "boc_rate":            (10100145, "1.2",     60, "%"),
    "retail_sales":        (20100008, "1.1",     60, "Millions CAD"),
    "trade_exports":       (12100011, "1.1",     60, "Millions CAD"),
    "trade_imports":       (12100011, "1.2",     60, "Millions CAD"),
}
# ──────────────────────────────────────────────────────────────────────────────

# COMMAND ----------
# =============================================================================
# SECTION 1: Core API helpers
# =============================================================================

def wds_post(endpoint, payload, timeout=30):
    """POST to the StatsCan WDS REST API."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{WDS_BASE}/{endpoint}",
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def parse_vector_points(vector_data_points):
    """Sort vectorDataPoint list → (labels, values). Uses refPerRaw then refPer for dates."""
    pts = sorted(
        vector_data_points,
        key=lambda p: p.get("refPerRaw") or p.get("refPer", "")
    )
    labels = [p.get("refPerRaw") or p.get("refPer") for p in pts]
    values = [float(p["value"]) for p in pts]
    return labels, values


def fetch_by_vector(vector_id, latest_n):
    """Fetch using a direct vector ID — most reliable, no coordinate guessing."""
    result = wds_post(
        "getDataFromVectorsAndLatestNPeriods",
        [{"vectorId": vector_id, "latestN": latest_n}]
    )
    obj = result[0]
    if obj.get("status") != "SUCCESS":
        raise ValueError(f"Vector {vector_id}: status={obj.get('status')}")
    return parse_vector_points(obj["object"]["vectorDataPoint"])


def fetch_by_coord(product_id, coordinate, latest_n):
    """Fetch using a product ID + coordinate string."""
    result = wds_post(
        "getDataFromCubePidCoordAndLatestNPeriods",
        [{"productId": product_id, "coordinate": coordinate, "latestN": latest_n}]
    )
    obj = result[0]
    if obj.get("status") != "SUCCESS":
        raise ValueError(f"PID {product_id} coord {coordinate}: status={obj.get('status')}")
    return parse_vector_points(obj["object"]["vectorDataPoint"])


def build_series(labels, values, unit):
    """Build the standardized series object expected by the website dashboard JS."""
    lv  = values[-1] if values else None
    pv  = values[-2] if len(values) > 1 else lv
    chg     = (lv - pv)        if lv is not None and pv is not None else 0
    chg_pct = (chg / pv * 100) if pv else 0
    return {
        "labels":        labels,
        "values":        values,
        "latestValue":   lv,
        "latestDate":    labels[-1] if labels else None,
        "change":        round(chg, 4),
        "changePercent": round(chg_pct, 4),
        "unit":          unit,
    }

# COMMAND ----------
# =============================================================================
# SECTION 2: Coordinate Discovery
# Run this section ONCE to find the correct coordinates for any table.
# Copy the output coordinate into COORD_SERIES above, then re-run the pipeline.
# =============================================================================

def discover_coordinate(product_id, dim_filters):
    """
    Find the dot-separated coordinate for given dimension filter strings.
    dim_filters: list of strings, one per dimension, matched case-insensitively.

    Example:
        discover_coordinate(36100104, ["canada", "chained", "seasonally adjusted", "gross domestic product"])
    """
    meta = wds_post("getCubeMetadata", [{"productId": product_id}])
    dims = meta[0].get("object", {}).get("dimension", [])

    indices = []
    for i, dim_filter in enumerate(dim_filters):
        if i >= len(dims):
            indices.append(1)
            continue
        members    = dims[i].get("member", [])
        filter_low = dim_filter.lower()
        match      = next(
            (m for m in members if filter_low in (m.get("memberNameEng") or "").lower()),
            None
        )
        member_id = match["memberId"] if match else 1
        matched_name = match["memberNameEng"] if match else "(fallback to 1)"
        print(f"  Dim {i+1} filter '{dim_filter}' → member {member_id}: {matched_name}")
        indices.append(member_id)

    coord = ".".join(str(x) for x in indices)
    print(f"  → Coordinate for PID {product_id}: {coord}\n")
    return coord


# Uncomment any line below and run this cell to discover the correct coordinate:
#
# discover_coordinate(36100104, ["canada", "chained", "seasonally adjusted", "gross domestic product at market prices"])
# discover_coordinate(18100004, ["canada", "all-items"])
# discover_coordinate(36100480, ["business sector", "labour productivity"])
# discover_coordinate(34100143, ["canada", "total"])
# discover_coordinate(10100145, ["bank rate"])
# discover_coordinate(20100008, ["canada", "total, retail trade"])
# discover_coordinate(12100011, ["total exports"])
# discover_coordinate(12100011, ["total imports"])

# COMMAND ----------
# =============================================================================
# SECTION 3: Fetch all series
# =============================================================================

def fetch_all_series():
    """
    Fetch every indicator series. Returns (series_dict, run_timestamp).
    Failures on individual series are logged and skipped — pipeline continues.
    """
    result = {}
    run_ts = datetime.now(timezone.utc)

    # Confirmed vector IDs — no coordinate guessing
    for name, (vector_id, latest_n, unit) in CONFIRMED_VECTORS.items():
        try:
            labels, values = fetch_by_vector(vector_id, latest_n)
            result[name]   = build_series(labels, values, unit)
            print(f"  ✓ {name:25s} {len(labels):3d} points  latest: {labels[-1]} = {values[-1]:.2f} {unit}")
        except Exception as e:
            print(f"  ✗ {name:25s} FAILED (vector {vector_id}): {e}")

    # Coordinate-based series
    for name, (pid, coord, latest_n, unit) in COORD_SERIES.items():
        try:
            labels, values = fetch_by_coord(pid, coord, latest_n)
            result[name]   = build_series(labels, values, unit)
            print(f"  ✓ {name:25s} {len(labels):3d} points  latest: {labels[-1]} = {values[-1]:.2f} {unit}")
        except Exception as e:
            print(f"  ✗ {name:25s} FAILED (PID {pid} coord {coord}): {e}")

    # Build trade balance from exports + imports if both fetched successfully
    if "trade_exports" in result and "trade_imports" in result:
        exp_s = result.pop("trade_exports")
        imp_s = result.pop("trade_imports")
        exp_map = dict(zip(exp_s["labels"], exp_s["values"]))
        imp_map = dict(zip(imp_s["labels"], imp_s["values"]))
        all_labels = sorted(set(exp_s["labels"]) | set(imp_s["labels"]))
        exports  = [exp_map.get(l) for l in all_labels]
        imports_ = [imp_map.get(l) for l in all_labels]
        balance  = [
            round(e - m, 2) if e is not None and m is not None else None
            for e, m in zip(exports, imports_)
        ]
        lv = next((v for v in reversed(balance) if v is not None), None)
        pv = next((v for v in reversed(balance[:-1]) if v is not None), lv)
        result["trade"] = {
            "labels":        all_labels,
            "exports":       exports,
            "imports":       imports_,
            "balance":       balance,
            "latestValue":   round(lv, 2) if lv is not None else None,
            "latestDate":    all_labels[-1] if all_labels else None,
            "change":        round(lv - pv, 2) if lv and pv else 0,
            "changePercent": round((lv - pv) / pv * 100, 4) if lv and pv else 0,
            "unit":          "Millions CAD",
        }
        print(f"  ✓ {'trade':25s} (built from exports + imports)")

    return result, run_ts

# COMMAND ----------
# =============================================================================
# SECTION 4: Write to Delta Lake
# Full history is stored here — each run upserts new/revised data points.
# Query it later with: spark.read.format("delta").load(DELTA_TABLE_PATH)
# =============================================================================

DELTA_SCHEMA = StructType([
    StructField("series_name", StringType(),    False),
    StructField("ref_period",  StringType(),    False),
    StructField("value",       DoubleType(),    True),
    StructField("unit",        StringType(),    True),
    StructField("fetched_at",  TimestampType(), False),
])


def write_to_delta(series_dict, run_ts):
    rows = []
    for name, series in series_dict.items():
        if "labels" not in series:
            continue   # trade has a non-standard shape; skip for history table
        for label, value in zip(series["labels"], series["values"]):
            if value is not None:
                rows.append((name, str(label), float(value), series.get("unit"), run_ts))

    df_new = spark.createDataFrame(rows, DELTA_SCHEMA)

    if DeltaTable.isDeltaTable(spark, DELTA_TABLE_PATH):
        dt = DeltaTable.forPath(spark, DELTA_TABLE_PATH)
        (
            dt.alias("existing")
            .merge(
                df_new.alias("new"),
                "existing.series_name = new.series_name AND existing.ref_period = new.ref_period"
            )
            .whenMatchedUpdateAll()
            .whenNotMatchedInsertAll()
            .execute()
        )
    else:
        df_new.write.format("delta").save(DELTA_TABLE_PATH)

    print(f"  ✓ Delta Lake: {df_new.count()} rows upserted → {DELTA_TABLE_PATH}")

# COMMAND ----------
# =============================================================================
# SECTION 5: Export JSON snapshot to Azure Blob Storage
# The website JS reads this file directly.  No CORS issues because it's a
# plain GET request to a public blob URL (not a POST to StatsCan).
# =============================================================================

def export_to_blob(series_dict, run_ts):
    from azure.storage.blob import BlobServiceClient, ContentSettings

    payload    = {"lastUpdated": run_ts.strftime("%Y-%m-%dT%H:%M:%SZ"), **series_dict}
    json_bytes = json.dumps(payload, default=str).encode("utf-8")

    client    = BlobServiceClient.from_connection_string(BLOB_CONNECTION_STRING)
    container = client.get_container_client(BLOB_CONTAINER)
    container.upload_blob(
        BLOB_FILE,
        json_bytes,
        overwrite=True,
        content_settings=ContentSettings(content_type="application/json")
    )

    blob_url = f"https://{client.account_name}.blob.core.windows.net/{BLOB_CONTAINER}/{BLOB_FILE}"
    print(f"  ✓ Blob exported → {blob_url}")
    return blob_url

# COMMAND ----------
# =============================================================================
# SECTION 6: Pipeline entry point
# This cell runs when the job executes.
# =============================================================================

print(f"{'='*60}")
print(f"StatsCan pipeline started: {datetime.now(timezone.utc).isoformat()}")
print(f"{'='*60}\n")

print("Fetching series from Statistics Canada WDS API...")
series_data, run_ts = fetch_all_series()

print(f"\nWriting to Delta Lake...")
write_to_delta(series_data, run_ts)

print(f"\nExporting JSON snapshot to Azure Blob Storage...")
blob_url = export_to_blob(series_data, run_ts)

print(f"\n{'='*60}")
print(f"Pipeline complete.")
print(f"Series fetched : {list(series_data.keys())}")
print(f"Blob URL       : {blob_url}")
print(f"  → Copy this URL into js/statscan.js → BLOB_DATA_URL")
print(f"{'='*60}")
