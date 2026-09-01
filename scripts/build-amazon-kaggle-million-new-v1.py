#!/usr/bin/env python3
import csv
import hashlib
import io
import json
import os
import re
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

SOURCE_ZIP = Path(os.environ.get("KAGGLE_ZIP", "/tmp/amazon-products-2023.zip"))
EDGE_URL = os.environ["MPR_OVERLAP_EDGE_URL"]
BASELINE_DISTINCT_ASINS = 500_000
TARGET_NEW_ASINS = 510_001
EXPECTED_FINAL_ASINS = BASELINE_DISTINCT_ASINS + TARGET_NEW_ASINS
BATCH_SIZE = 5_000
ASIN_RE = re.compile(r"^[A-Z0-9]{10}$")
MANIFEST_PATH = Path("/tmp/amazon-kaggle-million-new-asins.txt")
RECEIPT_PATH = Path("/tmp/amazon-kaggle-million-selection-receipt.json")


def oidc_token():
    url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    separator = "&" if "?" in url else "?"
    url += separator + urllib.parse.urlencode(
        {"audience": "mpr-amazon-kaggle-overlap"}
    )
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": "bearer "
            + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)["value"]


def classify_existing(asins, token):
    request = urllib.request.Request(
        EDGE_URL,
        data=json.dumps({"action": "classify", "asins": asins}).encode(),
        method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.load(response)
    if payload.get("writePerformed") is not False:
        raise SystemExit("OVERLAP_ENDPOINT_WRITE_CONTRACT_REJECTED")
    return set(payload["receipt"]["existingAsins"])


with zipfile.ZipFile(SOURCE_ZIP) as archive:
    csv_name = next(
        name for name in archive.namelist() if name.endswith("amazon_products.csv")
    )
    with archive.open(csv_name) as raw:
        reader = csv.DictReader(
            io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        )
        source_asins = sorted(
            {
                asin
                for row in reader
                if ASIN_RE.fullmatch(
                    asin := (row.get("asin") or "").strip().upper()
                )
            }
        )

selected = []
checked = 0
existing_seen = 0
overlap_calls = 0
token = None

for offset in range(0, len(source_asins), BATCH_SIZE):
    batch = source_asins[offset : offset + BATCH_SIZE]
    if token is None or overlap_calls % 25 == 0:
        token = oidc_token()
    existing = classify_existing(batch, token)
    overlap_calls += 1
    checked += len(batch)
    existing_seen += len(existing)
    selected.extend(
        asin
        for asin in batch
        if asin not in existing
        and len(selected) < TARGET_NEW_ASINS
    )
    if len(selected) == TARGET_NEW_ASINS:
        break

if len(selected) != TARGET_NEW_ASINS:
    raise SystemExit(
        f"NEW_ASIN_TARGET_NOT_MET:{len(selected)} checked={checked}"
    )
if len(set(selected)) != TARGET_NEW_ASINS:
    raise SystemExit("DUPLICATE_SELECTED_ASINS")

manifest = "\n".join(selected) + "\n"
manifest_sha = hashlib.sha256(manifest.encode()).hexdigest()
MANIFEST_PATH.write_text(manifest, encoding="utf-8")

receipt = {
    "schema": "MPR_AMAZON_MILLION_SELECTION_V1",
    "source": "asaniczka/amazon-products-dataset-2023-1-4m-products",
    "license": "ODC-By",
    "snapshot": "2023-09",
    "baselineDistinctAsins": BASELINE_DISTINCT_ASINS,
    "selectedNewAsins": len(selected),
    "expectedFinalDistinctAsins": EXPECTED_FINAL_ASINS,
    "checkedSourceAsins": checked,
    "existingAsinsSeen": existing_seen,
    "overlapCalls": overlap_calls,
    "manifestSha256": manifest_sha,
    "firstAsin": selected[0],
    "lastAsin": selected[-1],
    "writePerformed": False,
    "verifiedSales": False,
    "providerSpendEur": 0,
    "paidCallsTriggered": 0,
    "purchaseAuthorized": False,
}
RECEIPT_PATH.write_text(
    json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
)
print(json.dumps(receipt, indent=2, sort_keys=True))
