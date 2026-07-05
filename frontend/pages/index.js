import { useMemo, useState } from 'react';
import axios from 'axios';

const SQL_TYPES = ['TEXT', 'INTEGER', 'FLOAT', 'BOOLEAN', 'TIMESTAMP'];
const STEPS = ['Source', 'Map', 'Run'];

export default function Home() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [dbUrl, setDbUrl] = useState('');
  const [tableName, setTableName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [syncMode, setSyncMode] = useState('append');
  const [primaryKey, setPrimaryKey] = useState('');
  const [preview, setPreview] = useState(null);
  const [columns, setColumns] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  const schema = useMemo(() => {
    return columns.reduce((acc, col) => {
      if (col.enabled && col.name) acc[col.name] = col.type;
      return acc;
    }, {});
  }, [columns]);

  const readyToPreview = sheetUrl.trim() && apiKey.trim();
  const readyToRun = readyToPreview && dbUrl.trim() && tableName.trim() && columns.some(col => col.enabled);

  const loadPreview = async () => {
    setLoading(true);
    setMessage('');
    setResult(null);
    try {
      const res = await axios.post(
        '/api/preview',
        { sheet_url: sheetUrl },
        { headers: { 'X-API-Key': apiKey } }
      );
      setPreview(res.data);
      setColumns(res.data.columns.map(col => ({ ...col, enabled: true })));
      setPrimaryKey(res.data.columns[0]?.name || '');
      setActiveStep(1);
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Preview failed');
    }
    setLoading(false);
  };

  const runSync = async () => {
    setLoading(true);
    setMessage('');
    setResult(null);
    try {
      const res = await axios.post(
        '/api/sync',
        {
          sheet_url: sheetUrl,
          db_url: dbUrl,
          table_name: tableName,
          sync_mode: syncMode,
          primary_key: syncMode === 'upsert' ? primaryKey : null,
          schema_override: schema,
          columns,
        },
        { headers: { 'X-API-Key': apiKey } }
      );
      setResult(res.data);
      setActiveStep(2);
    } catch (e) {
      setMessage(e.response?.data?.detail || 'Sync failed');
    }
    setLoading(false);
  };

  const updateColumn = (index, patch) => {
    setColumns(current => current.map((col, i) => (i === index ? { ...col, ...patch } : col)));
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">sheets2sql</h1>
            <p className="mt-1 text-sm text-slate-600">Preview, map, and sync Google Sheets into Postgres.</p>
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
            {STEPS.map((step, index) => (
              <button
                key={step}
                className={`px-4 py-2 ${activeStep === index ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                onClick={() => setActiveStep(index)}
                type="button"
              >
                {index + 1}. {step}
              </button>
            ))}
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <Panel title="Source">
              <Field label="Google Sheet URL">
                <input className="input" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." />
              </Field>
              <Field label="API Key">
                <input className="input" value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="Backend API key" />
              </Field>
              <button className="primary-button" disabled={!readyToPreview || loading} onClick={loadPreview} type="button">
                {loading && activeStep !== 2 ? 'Loading preview...' : 'Load preview'}
              </button>
            </Panel>

            <Panel title="Destination">
              <Field label="Postgres connection string">
                <input className="input" value={dbUrl} onChange={e => setDbUrl(e.target.value)} placeholder="postgresql://user:pass@host:5432/db" />
              </Field>
              <Field label="Target table">
                <input className="input" value={tableName} onChange={e => setTableName(e.target.value)} placeholder="customers" />
              </Field>
              <Field label="Sync mode">
                <select className="input" value={syncMode} onChange={e => setSyncMode(e.target.value)}>
                  <option value="append">Append rows</option>
                  <option value="replace">Replace table</option>
                  <option value="upsert">Upsert by key</option>
                </select>
              </Field>
              {syncMode === 'upsert' && (
                <Field label="Primary key">
                  <select className="input" value={primaryKey} onChange={e => setPrimaryKey(e.target.value)}>
                    {columns.filter(col => col.enabled).map(col => (
                      <option key={col.name} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                </Field>
              )}
            </Panel>
          </aside>

          <section className="min-w-0 space-y-4">
            {message && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</div>
            )}

            {activeStep === 0 && (
              <EmptyState
                title="Connect a sheet"
                body="Enter a Google Sheet URL and API key, then load a preview before anything writes to Postgres."
              />
            )}

            {activeStep === 1 && (
              <Panel title="Preview and mapping">
                {preview ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Metric label="Rows" value={preview.row_count} />
                      <Metric label="Columns" value={columns.length} />
                      <Metric label="Enabled" value={columns.filter(col => col.enabled).length} />
                    </div>

                    {preview.warnings?.length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {preview.warnings.join(' ')}
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-md border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-100 text-left text-xs font-semibold uppercase text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Use</th>
                            <th className="px-3 py-2">Source</th>
                            <th className="px-3 py-2">Column name</th>
                            <th className="px-3 py-2">SQL type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {columns.map((col, index) => (
                            <tr key={`${col.source}-${index}`}>
                              <td className="px-3 py-2">
                                <input type="checkbox" checked={col.enabled} onChange={e => updateColumn(index, { enabled: e.target.checked })} />
                              </td>
                              <td className="max-w-[220px] truncate px-3 py-2 text-slate-600">{col.source}</td>
                              <td className="px-3 py-2">
                                <input className="input h-9 min-w-[160px]" value={col.name} onChange={e => updateColumn(index, { name: e.target.value })} />
                              </td>
                              <td className="px-3 py-2">
                                <select className="input h-9 min-w-[140px]" value={col.type} onChange={e => updateColumn(index, { type: e.target.value })}>
                                  {SQL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-x-auto rounded-md border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-100 text-left text-xs font-semibold uppercase text-slate-600">
                          <tr>
                            {columns.filter(col => col.enabled).map(col => <th key={col.name} className="px-3 py-2">{col.name}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {preview.sample_rows.slice(0, 8).map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {columns.filter(col => col.enabled).map(col => (
                                <td key={col.name} className="max-w-[240px] truncate px-3 py-2 text-slate-700">{String(row[col.source_name] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end">
                      <button className="primary-button max-w-xs" disabled={!readyToRun || loading} onClick={() => setActiveStep(2)} type="button">
                        Continue to run
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No preview yet" body="Load a preview from the source panel to inspect rows and map columns." />
                )}
              </Panel>
            )}

            {activeStep === 2 && (
              <Panel title="Run sync">
                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <h2 className="text-lg font-semibold">Execution plan</h2>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <PlanItem label="Source rows" value={preview?.row_count ?? '-'} />
                      <PlanItem label="Target table" value={tableName || '-'} />
                      <PlanItem label="Mode" value={syncMode} />
                      <PlanItem label="Primary key" value={syncMode === 'upsert' ? primaryKey || '-' : 'Not used'} />
                      <PlanItem label="Columns" value={Object.keys(schema).join(', ') || '-'} wide />
                    </dl>
                    <button className="primary-button mt-5 max-w-sm" disabled={!readyToRun || loading} onClick={runSync} type="button">
                      {loading ? 'Running sync...' : 'Run sync'}
                    </button>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <h2 className="text-lg font-semibold">Result</h2>
                    {result ? (
                      <div className="mt-4 space-y-3">
                        <Metric label="Status" value={result.status} />
                        <Metric label="Rows processed" value={result.rows} />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">Run the sync to see outcome details here.</p>
                    )}
                  </div>
                </div>
              </Panel>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase text-slate-500">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 break-words text-lg font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function PlanItem({ label, value, wide = false }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-950">{value}</dd>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-6 text-center">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-slate-600">{body}</p>
      </div>
    </div>
  );
}
