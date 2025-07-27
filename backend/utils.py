import pandas as pd
from typing import Dict

def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
    return df

def infer_schema(df: pd.DataFrame) -> Dict[str, str]:
    dtype_map = {
        'int64': 'INTEGER',
        'float64': 'FLOAT',
        'object': 'TEXT',
        'bool': 'BOOLEAN',
        'datetime64[ns]': 'TIMESTAMP',
    }
    return {col: dtype_map.get(str(dt), 'TEXT') for col, dt in df.dtypes.items()}
