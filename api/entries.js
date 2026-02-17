// Vercel Serverless Function für Dashboard Entries (In-Memory + localStorage Backup)
// Da Vercel Serverless read-only ist, nutzen wir localStorage im Browser als primären Speicher
const entries = new Map();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { date } = req.query;

    if (req.method === 'GET') {
      if (date) {
        // Get specific entry
        const entry = entries.get(date);
        return res.status(200).json({ data: entry || null, error: null });
      } else {
        // Get all entries (last 30 days)
        const allEntries = Array.from(entries.values());
        allEntries.sort((a, b) => b.date.localeCompare(a.date));
        return res.status(200).json({ data: allEntries.slice(0, 30), error: null });
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const entry = req.body;
      if (!entry || !entry.date) {
        return res.status(400).json({ data: null, error: 'Date is required' });
      }

      entries.set(entry.date, entry);
      return res.status(200).json({ data: entry, error: null });
    }

    return res.status(405).json({ data: null, error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ data: null, error: error.message });
  }
}
