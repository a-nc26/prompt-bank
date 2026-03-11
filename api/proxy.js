/**
 * Vercel serverless function — proxies requests to Google Apps Script to avoid CORS.
 * Mirrors the behaviour of scripts/proxy-server.cjs used in local dev.
 */
export default async function handler(req, res) {
    const { scriptUrl, ...rest } = req.query;

    if (!scriptUrl || !scriptUrl.startsWith('https://script.google.com/')) {
        res.status(400).json({ error: 'Missing or invalid scriptUrl' });
        return;
    }

    try {
        if (req.method === 'GET') {
            const qs = new URLSearchParams(rest).toString();
            const target = scriptUrl + (qs ? '?' + qs : '');
            const out = await fetch(target);
            const text = await out.text();
            res.status(out.status)
                .setHeader('Content-Type', out.headers.get('Content-Type') || 'application/json')
                .send(text);
        } else if (req.method === 'POST') {
            const out = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            const text = await out.text();
            res.status(out.status)
                .setHeader('Content-Type', out.headers.get('Content-Type') || 'application/json')
                .send(text);
        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (e) {
        res.status(502).json({ error: String(e.message || e) });
    }
}
