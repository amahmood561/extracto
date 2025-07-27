import os
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import gspread
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

app = FastAPI()
api_key_header = APIKeyHeader(name="X-API-Key")

# In-memory sync status (for demo)
sync_status = {}

class SyncRequest(BaseModel):
    sheet_url: str
    db_url: str
    table_name: str

class StatusResponse(BaseModel):
    last_status: Optional[str]
    rows_processed: Optional[int]


def get_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key

@app.post("/sync")
def sync_sheet(req: SyncRequest, api_key: str = Depends(get_api_key)):
    try:
        # Connect to Google Sheets
        gc = gspread.service_account()
        sh = gc.open_by_url(req.sheet_url)
        worksheet = sh.sheet1
        data = worksheet.get_all_records()
        df = pd.DataFrame(data)
        # Clean columns
        df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
        # Infer schema
        dtype_map = {
            'int64': 'INTEGER',
            'float64': 'FLOAT',
            'object': 'TEXT',
            'bool': 'BOOLEAN',
            'datetime64[ns]': 'TIMESTAMP',
        }
        schema = {col: dtype_map.get(str(dt), 'TEXT') for col, dt in df.dtypes.items()}
        # Connect to DB
        engine = create_engine(req.db_url)
        with engine.begin() as conn:
            # Create table if not exists
            cols = ', '.join([f'{col} {typ}' for col, typ in schema.items()])
            conn.execute(text(f'CREATE TABLE IF NOT EXISTS {req.table_name} ({cols});'))
            # Upsert rows
            for _, row in df.iterrows():
                keys = ', '.join(row.index)
                vals = ', '.join([f':{k}' for k in row.index])
                updates = ', '.join([f'{k}=EXCLUDED.{k}' for k in row.index])
                sql = f"INSERT INTO {req.table_name} ({keys}) VALUES ({vals}) ON CONFLICT DO UPDATE SET {updates}"
                conn.execute(text(sql), row.to_dict())
        sync_status[api_key] = {"status": "success", "rows": len(df)}
        return {"status": "success", "rows": len(df)}
    except Exception as e:
        sync_status[api_key] = {"status": f"error: {str(e)}", "rows": 0}
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status", response_model=StatusResponse)
def get_status(api_key: str = Depends(get_api_key)):
    stat = sync_status.get(api_key, {"status": None, "rows": None})
    return {"last_status": stat["status"], "rows_processed": stat["rows"]}
