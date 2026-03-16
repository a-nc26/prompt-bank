// Cloudflare Worker — OpenAI embeddings proxy
// Deployment steps:
//   1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
//   2. Paste this entire file, click Deploy
//   3. Copy the worker URL (e.g. https://pb-embed.YOUR-NAME.workers.dev)
//   4. Paste it into the app Settings → Embed Proxy URL

export default {
    async fetch(request) {
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        const auth = request.headers.get('Authorization');
        if (!auth) {
            return new Response(JSON.stringify({ error: { message: 'Missing Authorization header' } }), {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        const body = await request.text();

        const upstream = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': auth,
            },
            body,
        });

        const text = await upstream.text();
        return new Response(text, {
            status: upstream.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    },
};
