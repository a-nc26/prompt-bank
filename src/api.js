// api.js — All communication with Google Apps Script backend

const SCRIPT_URL_KEY = 'pb_script_url';
const OPENAI_KEY_KEY = 'pb_openai_key';

// When app is served FROM Apps Script, we inject the API URL so fetch works (iframe/sandbox can have different origin)
export const isEmbedded = () =>
  typeof window !== 'undefined' && window.__PROMPT_BANK_API_URL__ && window.__PROMPT_BANK_API_URL__ !== '__INJECT_SCRIPT_URL__';

const hasAppsScriptBridge = () =>
  typeof window !== 'undefined' &&
  !!window.google &&
  !!window.google.script &&
  !!window.google.script.run;

function getBaseUrl() {
  if (typeof window !== 'undefined' && window.location) {
    const loc = window.location;
    const injected = window.__PROMPT_BANK_API_URL__;
    const onAppsScriptHost = loc.hostname.includes('script.googleusercontent.com') || loc.hostname.includes('script.google.com');

    // In embedded HTMLService pages, keep full URL (including required query tokens)
    // and call same-origin to avoid CORS+credentials issues.
    if (onAppsScriptHost) {
      return loc.href.split('#')[0];
    }

    if (injected && injected !== '__INJECT_SCRIPT_URL__') return injected;
  }
  return localStorage.getItem(SCRIPT_URL_KEY) || '';
}

export const getScriptUrl = () => getBaseUrl();
export const setScriptUrl = (url) => localStorage.setItem(SCRIPT_URL_KEY, url);
export const getOpenAIKey = () => localStorage.getItem(OPENAI_KEY_KEY) || '';
export const setOpenAIKey = (key) => localStorage.setItem(OPENAI_KEY_KEY, key);

// Use proxy to avoid CORS (works in both dev and Vercel production).
// Only skip proxy when embedded in Apps Script or user explicitly chose direct.
const DIRECT_KEY = 'pb_direct_connection';
export const getDirectConnection = () => localStorage.getItem(DIRECT_KEY) === 'true';
export const setDirectConnection = (v) => localStorage.setItem(DIRECT_KEY, v ? 'true' : '');
const useProxy = () => !isEmbedded() && !getDirectConnection();

function throwIfHtml(text, context) {
    const t = (text || '').trim();
    const lower = t.toLowerCase();
    if (t.startsWith('<') && (lower.includes('<!doctype') || lower.includes('<html') || lower.includes('<body'))) {
        throw new Error(
      "Use the embedded option: run npm run build:embed, paste the app into Apps Script (see README). Then open your Web App URL — works with 'Within my org'."
    );
    }
}

function gasRun(action, payload = {}) {
    return new Promise((resolve, reject) => {
        if (!hasAppsScriptBridge()) {
            reject(new Error('Apps Script bridge is not available.'));
            return;
        }
        window.google.script.run
            .withSuccessHandler((result) => {
                if (result && result.error) {
                    reject(new Error(result.error));
                    return;
                }
                resolve(result);
            })
            .withFailureHandler((err) => {
                reject(new Error(err && err.message ? err.message : String(err)));
            })
            .apiAction(action, payload);
    });
}

function buildUrl(base, params = {}) {
    const url = new URL(base, typeof window !== 'undefined' ? window.location.origin : undefined);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    return url.toString();
}

// ── Gas API helpers ──────────────────────────────────────────

async function gasGet(params = {}) {
    if (hasAppsScriptBridge() && params.action) {
        return gasRun(params.action, params);
    }
    const base = getBaseUrl();
    if (!base) throw new Error('Apps Script URL not configured. Go to Settings.');
    const useProxyNow = useProxy();
    const target = useProxyNow
        ? `/api/proxy?scriptUrl=${encodeURIComponent(base)}&${new URLSearchParams({ ...params }).toString()}`
        : buildUrl(base, params);
    const res = await fetch(target, useProxyNow ? {} : { credentials: 'include' });
    const text = await res.text();
    throwIfHtml(text);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    try {
        return JSON.parse(text);
    } catch {
        throw new Error('Received non-JSON response from Apps Script. Make sure your Web App URL is the deployed /exec URL.');
    }
}

async function gasPost(body = {}) {
    if (hasAppsScriptBridge() && body.action) {
        return gasRun(body.action, body);
    }
    const base = getBaseUrl();
    if (!base) throw new Error('Apps Script URL not configured. Go to Settings.');
    const useProxyNow = useProxy();
    const target = useProxyNow ? `/api/proxy?scriptUrl=${encodeURIComponent(base)}` : buildUrl(base);
    const res = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        ...(useProxyNow ? {} : { credentials: 'include' }),
    });
    const text = await res.text();
    throwIfHtml(text);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    try {
        return JSON.parse(text);
    } catch {
        throw new Error('Received non-JSON response from Apps Script. Make sure your Web App URL is the deployed /exec URL.');
    }
}

// ── Public API ───────────────────────────────────────────────

/** Fetch all prompts */
export async function fetchPrompts() {
    return gasGet({ action: 'getAll' });
}

/** Search prompts by query string (similarity done server-side) */
export async function searchPrompts(query) {
    return gasGet({ action: 'search', query });
}

/** Add new prompts (batch) */
export async function addPrompts(prompts) {
    return gasPost({ action: 'addPrompts', prompts });
}

/** Update a single prompt's rating */
export async function updateRating(id, rating) {
    return gasPost({ action: 'updateRating', id, rating });
}

/** Delete a prompt by id */
export async function deletePrompt(id) {
    return gasPost({ action: 'deletePrompt', id });
}

/** Classify prompts via OpenAI (server-side in Apps Script) */
export async function classifyPrompts(prompts) {
    return gasPost({ action: 'classify', prompts });
}

/** Test connection */
export async function testConnection() {
    return gasGet({ action: 'ping' });
}
