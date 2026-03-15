// api.js — GitHub-backed data store
// Reads/writes prompts.json in your GitHub repo via the Contents API.

const KEYS = {
  owner:  'pb_gh_owner',
  repo:   'pb_gh_repo',
  pat:    'pb_gh_pat',
  branch: 'pb_gh_branch',
  openai: 'pb_openai_key',
};

const PROMPTS_FILE = 'prompts.json';
const GH_API = 'https://api.github.com';

// ── Config helpers ────────────────────────────────────────────

export function getGitHubConfig() {
  return {
    owner:  localStorage.getItem(KEYS.owner)  || import.meta.env.VITE_GH_OWNER || '',
    repo:   localStorage.getItem(KEYS.repo)   || import.meta.env.VITE_GH_REPO  || '',
    pat:    localStorage.getItem(KEYS.pat)    || '',
    branch: localStorage.getItem(KEYS.branch) || 'main',
  };
}

export function setGitHubConfig({ owner, repo, pat, branch }) {
  localStorage.setItem(KEYS.owner,  owner);
  localStorage.setItem(KEYS.repo,   repo);
  localStorage.setItem(KEYS.pat,    pat);
  localStorage.setItem(KEYS.branch, branch || 'main');
}

export const getOpenAIKey = () => localStorage.getItem(KEYS.openai) || '';
export const setOpenAIKey = (key) => localStorage.setItem(KEYS.openai, key);

// ── GitHub API internals ──────────────────────────────────────

function ghHeaders(pat) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (pat) h.Authorization = `Bearer ${pat}`;
  return h;
}

function encodeContent(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decodeContent(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function readFile() {
  const { owner, repo, pat, branch } = getGitHubConfig();
  if (!owner || !repo) throw new Error('GitHub repo not configured. Go to Settings.');

  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/contents/${PROMPTS_FILE}?ref=${branch}`,
    { headers: ghHeaders(pat) }
  );

  if (res.status === 404) return { prompts: [], sha: null };

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  const parsed = JSON.parse(decodeContent(data.content));
  return {
    prompts: Array.isArray(parsed) ? parsed : (parsed.prompts || []),
    sha: data.sha,
  };
}

async function writeFile(prompts, sha, message = 'Update prompts') {
  const { owner, repo, pat, branch } = getGitHubConfig();
  if (!pat) throw new Error('GitHub PAT required for write operations. Go to Settings.');

  const body = {
    message,
    content: encodeContent(JSON.stringify(prompts, null, 2)),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/contents/${PROMPTS_FILE}`,
    {
      method: 'PUT',
      headers: { ...ghHeaders(pat), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API write error: ${res.status}`);
  }
  return res.json();
}

// ── Public API ────────────────────────────────────────────────

export async function fetchPrompts() {
  const { prompts } = await readFile();
  return prompts;
}

export async function searchPrompts(query) {
  const prompts = await fetchPrompts();
  const q = query.toLowerCase();
  return prompts.filter(p =>
    p.text?.toLowerCase().includes(q) ||
    p.category?.toLowerCase().includes(q) ||
    p.abuseArea?.toLowerCase().includes(q)
  );
}

export async function addPrompts(newPrompts) {
  const { prompts, sha } = await readFile();
  const updated = [...prompts, ...newPrompts];
  await writeFile(updated, sha, `Add ${newPrompts.length} prompt(s)`);
  return updated;
}

export async function updateRating(id, rating) {
  const { prompts, sha } = await readFile();
  const updated = prompts.map(p => p.id === id ? { ...p, rating } : p);
  await writeFile(updated, sha, `Update rating for prompt ${id}`);
  return updated;
}

export async function deletePrompt(id) {
  const { prompts, sha } = await readFile();
  const updated = prompts.filter(p => p.id !== id);
  await writeFile(updated, sha, `Delete prompt ${id}`);
  return updated;
}

export async function testConnection() {
  const { owner, repo, pat } = getGitHubConfig();
  if (!owner || !repo) throw new Error('GitHub owner and repo are required.');

  const res = await fetch(`${GH_API}/repos/${owner}/${repo}`, {
    headers: ghHeaders(pat),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Cannot access repo: ${res.status}`);
  }
  return { status: 'ok', message: 'pong' };
}

export async function classifyPrompts(prompts) {
  return prompts;
}
