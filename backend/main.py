import os
import re
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import Optional, List, Dict
import pandas as pd
import gspread
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

app = FastAPI()
api_key_header = APIKeyHeader(name="X-API-Key")

# In-memory sync status (for demo)
sync_status = {}

class SyncColumn(BaseModel):
    source: str
    name: str
    type: str
    enabled: bool = True
    source_name: Optional[str] = None

class SyncRequest(BaseModel):
    sheet_url: str
    db_url: str
    table_name: str
    sync_mode: str = "append"
    primary_key: Optional[str] = None
    schema_override: Optional[Dict[str, str]] = None
    columns: Optional[List[SyncColumn]] = None

class PreviewRequest(BaseModel):
    sheet_url: str

class StatusResponse(BaseModel):
    last_status: Optional[str]
    rows_processed: Optional[int]


def get_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key

def clean_identifier(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]+", "_", value.strip().lower()).strip("_")
    if not cleaned:
        cleaned = "column"
    if cleaned[0].isdigit():
        cleaned = f"col_{cleaned}"
    return cleaned

def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'

def load_sheet(sheet_url: str) -> pd.DataFrame:
    gc = gspread.service_account()
    sh = gc.open_by_url(sheet_url)
    worksheet = sh.sheet1
    return pd.DataFrame(worksheet.get_all_records())

def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    seen = {}
    columns = []
    for col in df.columns:
        base = clean_identifier(str(col))
        count = seen.get(base, 0)
        seen[base] = count + 1
        columns.append(base if count == 0 else f"{base}_{count + 1}")
    df.columns = columns
    return df

def infer_schema(df: pd.DataFrame) -> Dict[str, str]:
    dtype_map = {
        "int64": "INTEGER",
        "float64": "FLOAT",
        "object": "TEXT",
        "bool": "BOOLEAN",
        "datetime64[ns]": "TIMESTAMP",
    }
    return {col: dtype_map.get(str(dt), "TEXT") for col, dt in df.dtypes.items()}

@app.post("/preview")
def preview_sheet(req: PreviewRequest, api_key: str = Depends(get_api_key)):
    try:
        raw_df = load_sheet(req.sheet_url)
        original_columns = [str(col) for col in raw_df.columns]
        df = clean_columns(raw_df.copy())
        schema = infer_schema(df)
        warnings = []
        if len(set(original_columns)) != len(original_columns):
            warnings.append("Duplicate headers were detected and renamed.")
        if df.empty:
            warnings.append("No rows were found in the first worksheet.")
        empty_columns = [col for col in df.columns if df[col].isna().all()]
        if empty_columns:
            warnings.append(f"Empty columns: {', '.join(empty_columns)}")

        return {
            "columns": [
                {"source": source, "source_name": name, "name": name, "type": schema[name]}
                for source, name in zip(original_columns, df.columns)
            ],
            "sample_rows": df.head(20).where(pd.notnull(df), None).to_dict(orient="records"),
            "row_count": len(df),
            "warnings": warnings,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sync")
def sync_sheet(req: SyncRequest, api_key: str = Depends(get_api_key)):
    try:
        df = clean_columns(load_sheet(req.sheet_url))
        if req.columns:
            renamed = {}
            selected = []
            for col in req.columns:
                if not col.enabled:
                    continue
                source = clean_identifier(col.source_name or col.source)
                name = clean_identifier(col.name)
                if source in df.columns:
                    renamed[source] = name
                    selected.append(source)
            df = df[selected].rename(columns=renamed)

        schema = req.schema_override or infer_schema(df)
        table_name = clean_identifier(req.table_name)
        primary_key = clean_identifier(req.primary_key) if req.primary_key else None
        allowed_types = {"TEXT", "INTEGER", "FLOAT", "BOOLEAN", "TIMESTAMP"}
        schema = {clean_identifier(col): typ if typ in allowed_types else "TEXT" for col, typ in schema.items()}

        engine = create_engine(req.db_url)
        with engine.begin() as conn:
            if req.sync_mode == "replace":
                conn.execute(text(f"DROP TABLE IF EXISTS {quote_identifier(table_name)};"))

            cols = ", ".join([
                f"{quote_identifier(col)} {typ}{' PRIMARY KEY' if req.sync_mode == 'upsert' and col == primary_key else ''}"
                for col, typ in schema.items()
            ])
            conn.execute(text(f"CREATE TABLE IF NOT EXISTS {quote_identifier(table_name)} ({cols});"))

            for _, row in df.iterrows():
                values = {clean_identifier(k): v for k, v in row.to_dict().items()}
                keys = ", ".join(quote_identifier(k) for k in values.keys())
                vals = ", ".join([f":{k}" for k in values.keys()])
                sql = f"INSERT INTO {quote_identifier(table_name)} ({keys}) VALUES ({vals})"
                if req.sync_mode == "upsert" and primary_key:
                    updates = ", ".join(
                        f"{quote_identifier(k)}=EXCLUDED.{quote_identifier(k)}"
                        for k in values.keys()
                        if k != primary_key
                    )
                    if updates:
                        sql += f" ON CONFLICT ({quote_identifier(primary_key)}) DO UPDATE SET {updates}"
                conn.execute(text(sql), values)
        sync_status[api_key] = {"status": "success", "rows": len(df)}
        return {"status": "success", "rows": len(df)}
    except Exception as e:
        sync_status[api_key] = {"status": f"error: {str(e)}", "rows": 0}
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status", response_model=StatusResponse)
def get_status(api_key: str = Depends(get_api_key)):
    stat = sync_status.get(api_key, {"status": None, "rows": None})
    return {"last_status": stat["status"], "rows_processed": stat["rows"]}
