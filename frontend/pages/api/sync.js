import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000/sync';
    const apiKey = req.headers['x-api-key'] || '';
    const response = await axios.post(
      backendUrl,
      req.body,
      { headers: { 'X-API-Key': apiKey } }
    );
    res.status(200).json(response.data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ detail: e.response?.data?.detail || 'Error' });
  }
}
