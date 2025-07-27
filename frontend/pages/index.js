import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [dbUrl, setDbUrl] = useState('');
  const [tableName, setTableName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setStatus('');
    setRows(null);
    try {
      const res = await axios.post(
        '/api/sync',
        { sheet_url: sheetUrl, db_url: dbUrl, table_name: tableName },
        { headers: { 'X-API-Key': apiKey } }
      );
      setStatus(res.data.status);
      setRows(res.data.rows);
    } catch (e) {
      setStatus(e.response?.data?.detail || 'Error');
    }
    setLoading(false);
  };

  const handleStatus = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/status', { headers: { 'X-API-Key': apiKey } });
      setStatus(res.data.last_status);
      setRows(res.data.rows_processed);
    } catch (e) {
      setStatus(e.response?.data?.detail || 'Error');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">sheets2sql</h1>
        <input
          className="mb-2 p-2 border rounded w-full"
          placeholder="Google Sheet URL"
          value={sheetUrl}
          onChange={e => setSheetUrl(e.target.value)}
        />
        <input
          className="mb-2 p-2 border rounded w-full"
          placeholder="Postgres Connection String"
          value={dbUrl}
          onChange={e => setDbUrl(e.target.value)}
        />
        <input
          className="mb-2 p-2 border rounded w-full"
          placeholder="Target Table Name"
          value={tableName}
          onChange={e => setTableName(e.target.value)}
        />
        <input
          className="mb-4 p-2 border rounded w-full"
          placeholder="API Key"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
        />
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full mb-2"
          onClick={handleSync}
          disabled={loading}
        >
          {loading ? 'Syncing...' : 'Sync Now'}
        </button>
        <button
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full"
          onClick={handleStatus}
          disabled={loading}
        >
          Check Last Sync Status
        </button>
        <div className="mt-4 text-center">
          {status && <div>Status: {status}</div>}
          {rows !== null && <div>Rows Processed: {rows}</div>}
        </div>
      </div>
    </div>
  );
}
