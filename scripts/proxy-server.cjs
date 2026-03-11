/**
 * Standalone proxy for Google Apps Script — avoids CORS when app runs on localhost.
 * Run: node scripts/proxy-server.cjs
 * Then in Vite, /api/* is forwarded here.
 */
const http = require('http');

const PORT = 3456;

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/api/proxy')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const scriptUrl = url.searchParams.get('scriptUrl');
  if (!scriptUrl || !scriptUrl.startsWith('https://script.google.com/')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing or invalid scriptUrl' }));
    return;
  }

  try {
    if (req.method === 'GET') {
      url.searchParams.delete('scriptUrl');
      const qs = url.searchParams.toString();
      const target = scriptUrl + (qs ? '?' + qs : '');
      const out = await fetch(target);
      const text = await out.text();
      res.writeHead(out.status, { 'Content-Type': out.headers.get('Content-Type') || 'application/json' });
      res.end(text);
    } else if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString('utf8');
      const out = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await out.text();
      res.writeHead(out.status, { 'Content-Type': out.headers.get('Content-Type') || 'application/json' });
      res.end(text);
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(e.message || e) }));
  }
});

server.listen(PORT, () => {
  console.log(`[proxy] Apps Script proxy on http://localhost:${PORT}`);
});
