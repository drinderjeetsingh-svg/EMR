import os
import kagglehub
import pandas as pd
import numpy as np
from supabase import create_client

SUPABASE_URL = "https://hyptntjxfhyefytfxsgc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cHRudGp4Zmh5ZWZ5dGZ4c2djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTYxNDIsImV4cCI6MjEwMzIzMjE0Mn0.FMsl49ypSrLE-T76Ffvz870myT4eX_lmbjcNwi4ONGE"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("1. Downloading / Locating medicine dataset from Kaggle...")
path = kagglehub.dataset_download("shudhanshusingh/az-medicine-dataset-of-india")

# Locate CSV
csv_file = None
for root_dir, _, files in os.walk(path):
    for file in files:
        if file.endswith(".csv"):
            csv_file = os.path.join(root_dir, file)
            break

if not csv_file:
    raise FileNotFoundError("CSV file not found.")

print(f"2. Reading CSV from {csv_file}...")
df = pd.read_csv(csv_file, low_memory=False)

print("Detected columns in CSV:", list(df.columns))

# Map columns dynamically based on dataset headers
# 1. Brand name mapping
if 'name' in df.columns:
    df['brand_name'] = df['name']
elif 'brand_name' not in df.columns:
    df['brand_name'] = df.iloc[:, 1]

# 2. Composition mapping (combine short_composition1 + short_composition2 if separate)
if 'short_composition1' in df.columns and 'short_composition2' in df.columns:
    df['generic_composition'] = (
        df['short_composition1'].fillna('').astype(str) + " " + 
        df['short_composition2'].fillna('').astype(str)
    ).str.strip()
elif 'composition' in df.columns:
    df['generic_composition'] = df['composition']
elif 'short_composition1' in df.columns:
    df['generic_composition'] = df['short_composition1']
else:
    df['generic_composition'] = ""

# 3. Dosage form / Type mapping
if 'type' in df.columns:
    df['dosage_form'] = df['type']
elif 'dosage_form' not in df.columns:
    df['dosage_form'] = 'Allopathic'

# 4. Manufacturer mapping
if 'manufacturer_name' in df.columns:
    df['manufacturer'] = df['manufacturer_name']
elif 'manufacturer' not in df.columns:
    df['manufacturer'] = ""

# Keep only needed columns and drop rows with empty brand names
clean_df = df[['brand_name', 'generic_composition', 'dosage_form', 'manufacturer']].copy()
clean_df = clean_df.dropna(subset=['brand_name'])
clean_df = clean_df[clean_df['brand_name'].str.strip() != '']

# Replace NaNs with None so JSON serialization passes SQL NULL cleanly
clean_df = clean_df.replace({np.nan: None})

records = clean_df.to_dict(orient='records')
total_records = len(records)
print(f"3. Total valid medicine rows ready for import: {total_records}")

# Upload in batches of 1,000
BATCH_SIZE = 1000
for i in range(0, total_records, BATCH_SIZE):
    batch = records[i:i + BATCH_SIZE]
    supabase.table("master_medicines").insert(batch).execute()
    print(f"Uploaded {min(i + BATCH_SIZE, total_records)} / {total_records} records...")

print("Master medicines dataset successfully imported into Supabase!")
