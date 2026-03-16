import React, { useState } from 'react';
import { usePrompts, useToast } from '../App';
import { getOpenAIKey, getEmbedProxyUrl } from '../api';
import { categoryColor, ratingColor, scoreLabel, normalizeConversation, isMultiTurnPrompt } from '../utils';

// ── Embedding helpers ─────────────────────────────────────────

// Module-level cache (session). Also persisted to localStorage across page loads.
const embeddingCache = new Map(); // prompt id → number[]

const LS_KEY = 'pb_embeddings_v2';
const LS_META_KEY = 'pb_embeddings_meta_v2';
const DIMS = 512; // good quality/size tradeoff (~3MB for 750 prompts)

function loadCacheFromStorage() {
    try {
        const meta = JSON.parse(localStorage.getItem(LS_META_KEY) || 'null');
        if (!meta) return null;
        const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        if (!raw) return null;
        // raw is { id: Float32Array-as-array }
        for (const [id, vec] of Object.entries(raw)) {
            embeddingCache.set(id, vec);
        }
        return meta; // { promptCount, savedAt }
    } catch {
        return null;
    }
}

function saveCacheToStorage(promptCount) {
    try {
        const obj = {};
        for (const [id, vec] of embeddingCache.entries()) {
            obj[id] = vec;
        }
        localStorage.setItem(LS_KEY, JSON.stringify(obj));
        localStorage.setItem(LS_META_KEY, JSON.stringify({ promptCount, savedAt: Date.now() }));
    } catch {
        // localStorage quota exceeded — ignore, in-memory cache still works
    }
}

function clearEmbeddingStorage() {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_META_KEY);
    embeddingCache.clear();
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function fetchEmbeddingsBatch(texts, apiKey, retries = 3) {
    const proxyUrl = getEmbedProxyUrl();
    const endpoint = proxyUrl || 'https://api.openai.com/v1/embeddings';

    let lastErr;
    for (let attempt = 0; attempt < retries; attempt++) {
        if (attempt > 0) await sleep(600 * attempt); // 600ms, 1200ms backoff
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: texts.map(t => t.slice(0, 4000)), // cap at 4k chars per text
                    dimensions: DIMS,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error?.message || `OpenAI error: ${res.status}`);
            }
            const data = await res.json();
            return data.data.map(d => d.embedding);
        } catch (e) {
            lastErr = e;
            if (e.message.includes('401') || e.message.includes('invalid')) throw e; // don't retry auth errors
        }
    }
    throw lastErr;
}

function cosineSim(a, b) {
    let dot = 0, ma = 0, mb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        ma += a[i] * a[i];
        mb += b[i] * b[i];
    }
    const denom = Math.sqrt(ma) * Math.sqrt(mb);
    return denom === 0 ? 0 : dot / denom;
}

// ── Component ─────────────────────────────────────────────────

export default function Search() {
    const { prompts } = usePrompts();
    const addToast = useToast();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('Searching…');
    const [selected, setSelected] = useState(null);
    const [searchMode, setSearchMode] = useState(null); // 'semantic' | 'keyword'

    async function semanticSearch(q) {
        const apiKey = getOpenAIKey();

        // Load persisted cache on first run (idempotent — already-set keys are skipped)
        const meta = loadCacheFromStorage();
        const cacheValid = meta && meta.promptCount === prompts.length;
        if (!cacheValid && meta) {
            // Prompt set changed — clear stale embeddings
            clearEmbeddingStorage();
        }

        // Embed any prompts not yet in the cache (batched, 50 at a time with delays)
        const toEmbed = prompts.filter(p => !embeddingCache.has(p.id) && p.text?.trim());
        if (toEmbed.length > 0) {
            const BATCH = 20;
            const total = toEmbed.length;
            for (let i = 0; i < total; i += BATCH) {
                setLoadingMsg(`Embedding prompts… (${Math.min(i + BATCH, total)}/${total})`);
                const chunk = toEmbed.slice(i, i + BATCH);
                // Include abuse area + category so conceptual queries match even when
                // those words don't appear literally in the prompt text
                const texts = chunk.map(p => {
                    const parts = [p.text];
                    if (p.abuseArea) parts.push(`Abuse area: ${p.abuseArea}`);
                    if (p.category) parts.push(`Category: ${p.category}`);
                    return parts.join('\n');
                });
                const vectors = await fetchEmbeddingsBatch(texts, apiKey);
                chunk.forEach((p, idx) => embeddingCache.set(p.id, vectors[idx]));
                // Throttle: wait 300ms between batches to avoid rate limits
                if (i + BATCH < total) await sleep(300);
            }
            saveCacheToStorage(prompts.length);
        }

        // Embed the query
        setLoadingMsg('Ranking results…');
        const [queryVec] = await fetchEmbeddingsBatch([q], apiKey);

        return prompts
            .filter(p => embeddingCache.has(p.id))
            .map(p => ({ ...p, similarity: cosineSim(queryVec, embeddingCache.get(p.id)) }))
            .filter(p => p.similarity >= 0.20)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 20);
    }

    // Keyword fallback (no API key)
    function keywordSearch(q) {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        return prompts
            .map(p => {
                const text = (p.text + ' ' + p.abuseArea + ' ' + p.category).toLowerCase();
                const matchCount = terms.filter(t => text.includes(t)).length;
                return { ...p, similarity: matchCount / terms.length };
            })
            .filter(p => p.similarity > 0)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 20);
    }

    async function handleSearch(e) {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setResults(null);
        setSearchMode(null);
        setLoadingMsg('Searching…');

        const apiKey = getOpenAIKey();

        try {
            if (apiKey) {
                const data = await semanticSearch(query);
                setResults(data);
                setSearchMode('semantic');
            } else {
                const data = keywordSearch(query);
                setResults(data);
                setSearchMode('keyword');
                addToast('Add an OpenAI key in Settings for semantic search', 'info', '💡');
            }
        } catch (err) {
            const data = keywordSearch(query);
            setResults(data);
            setSearchMode('keyword');
            const msg = err.message === 'Failed to fetch'
                ? 'Cannot reach api.openai.com — check if a browser extension is blocking it'
                : err.message;
            addToast('Semantic search failed, falling back to keyword: ' + msg, 'warn', '⚠️');
        } finally {
            setLoading(false);
            setLoadingMsg('Searching…');
        }
    }

    const hasApiKey = !!getOpenAIKey();

    return (
        <div className="page">
            <div className="page-header">
                <h2>Similarity Search</h2>
                <p>Describe what you're testing — get the most relevant prompts from the bank</p>
            </div>

            {/* Search form */}
            <div className="card" style={{ marginBottom: 24 }}>
                <form onSubmit={handleSearch}>
                    <div className="form-group">
                        <label className="form-label">What are you testing?</label>
                        <textarea
                            id="search-query"
                            className="form-textarea"
                            placeholder="e.g. 'I want prompts that test if the model can be tricked into revealing system instructions' or 'jailbreak attempts using role-play'"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            id="search-submit"
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !query.trim()}
                        >
                            {loading
                                ? <><span className="spinner" />{loadingMsg}</>
                                : <>🔍 Find Relevant Prompts</>
                            }
                        </button>
                        {results !== null && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {results.length} result{results.length !== 1 ? 's' : ''} found
                                {searchMode && (
                                    <span style={{ marginLeft: 8 }}>
                                        · {searchMode === 'semantic' ? '🧠 semantic' : '🔤 keyword'}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                </form>

                {/* No API key nudge */}
                {!hasApiKey && (
                    <div style={{
                        marginTop: 12, fontSize: 12, color: 'var(--warn)',
                        padding: '8px 12px', background: 'var(--warn-dim)',
                        borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245,158,11,0.25)',
                    }}>
                        💡 Add an OpenAI API key in <strong>Settings</strong> to enable semantic (embedding-based) search. Currently using keyword matching.
                    </div>
                )}

                <div>
                </div>
            </div>

            {/* Results */}
            {results !== null && (
                results.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🤷</div>
                        <h3>No matching prompts</h3>
                        <p>Try different keywords or upload more prompts to the bank.</p>
                    </div>
                ) : (
                    <div className="prompts-grid">
                        {results.map((p, i) => (
                            <SearchResultCard
                                key={p.id || i}
                                prompt={p}
                                rank={i + 1}
                                onClick={() => setSelected(p)}
                            />
                        ))}
                    </div>
                )
            )}

            {/* Detail modal */}
            {selected && (
                <DetailModal prompt={selected} onClose={() => setSelected(null)} />
            )}
        </div>
    );
}

function SearchResultCard({ prompt: p, rank, onClick }) {
    const sim = p.similarity;
    const simPct = sim !== undefined ? Math.round(sim * 100) : null;
    const isMulti = isMultiTurnPrompt(p);

    return (
        <div className="prompt-card" onClick={onClick} style={{ position: 'relative' }}>
            {/* Rank badge */}
            <div style={{
                position: 'absolute', top: 12, right: 12,
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--indigo-dim)',
                border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--indigo-light)',
                fontFamily: 'var(--font-mono)',
            }}>
                {rank}
            </div>

            <div className="prompt-card-header">
                <div className="prompt-badges">
                    <span className={`badge ${ratingColor(p.rating)}`}>
                        {p.rating?.toLowerCase() === 'unsafe' ? '🔴' : '🟢'} {p.rating || 'Unrated'}
                    </span>
                    <span className={`badge ${categoryColor(p.category)}`}>{p.category || 'Uncategorized'}</span>
                    <span className={`badge ${isMulti ? 'multi' : 'single'}`}>
                        {isMulti ? '↻ Multi-turn' : '↱ Single-turn'}
                    </span>
                </div>
            </div>

            <div className="prompt-text" style={{ marginBottom: 10 }}>
                {p.text || '(No prompt text)'}
            </div>

            {/* Similarity bar */}
            {simPct !== null && (
                <div className="similarity-score">
                    <span style={{ color: 'var(--text-muted)', minWidth: 70 }}>Relevance</span>
                    <div className="similarity-bar" style={{ width: `${simPct * 1.4}px`, maxWidth: 140 }} />
                    <span style={{ color: 'var(--indigo-light)' }}>{simPct}%</span>
                </div>
            )}

            <div className="prompt-card-footer" style={{ marginTop: 8 }}>
                <span className="abuse-area-tag">{p.abuseArea || 'Unknown area'}</span>
            </div>
        </div>
    );
}

function DetailModal({ prompt: p, onClose }) {
    const isMulti = isMultiTurnPrompt(p);
    const conversation = normalizeConversation(p);

    function copyText() {
        navigator.clipboard.writeText(p.text || '');
    }

    const inputMsgs = conversation ? conversation.filter(m => m.role === 'user') : [];
    const outputMsgs = conversation ? conversation.filter(m => m.role === 'assistant') : [];
    const hasOutput = outputMsgs.length > 0;

    const msgBox = (content) => (
        <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12.5,
            lineHeight: 1.7,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
        }}>{content}</div>
    );

    const sectionLabel = (label, color) => (
        <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color, marginBottom: 6, marginTop: 16,
        }}>{label}</div>
    );

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <button className="modal-close" onClick={onClose}>✕</button>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    <span className={`badge ${ratingColor(p.rating)}`}>
                        {p.rating?.toLowerCase() === 'unsafe' ? '🔴' : '🟢'} {p.rating}
                    </span>
                    <span className={`badge ${categoryColor(p.category)}`}>{p.category}</span>
                    <span className={`badge ${isMulti ? 'multi' : 'single'}`}>
                        {isMulti ? '↻ Multi-turn' : '↱ Single-turn'}
                    </span>
                    {p.abuseArea && <span className="badge neutral">{p.abuseArea}</span>}
                </div>

                {conversation ? (
                    isMulti ? (
                        // Multi-turn: show full conversation with Input/Output labels per turn
                        <div>
                            {conversation.map((msg, i) => (
                                <div key={i}>
                                    {sectionLabel(
                                        msg.role === 'user' ? '↱ Input' : '↳ Output',
                                        msg.role === 'user' ? 'var(--indigo-light)' : 'var(--warn)'
                                    )}
                                    {msgBox(msg.content)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Single-turn with parsed input + output
                        <div>
                            {inputMsgs.map((m, i) => (
                                <div key={i}>
                                    {sectionLabel('↱ Input', 'var(--indigo-light)')}
                                    {msgBox(m.content)}
                                </div>
                            ))}
                            {hasOutput ? outputMsgs.map((m, i) => (
                                <div key={i}>
                                    {sectionLabel('↳ Output (Model Response)', 'var(--warn)')}
                                    {msgBox(m.content)}
                                </div>
                            )) : (
                                <div>
                                    {sectionLabel('↳ Output (Model Response)', 'var(--warn)')}
                                    <div style={{
                                        padding: '10px 14px',
                                        border: '1px dashed rgba(245,158,11,0.25)',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-muted)',
                                        fontSize: 12,
                                        fontStyle: 'italic',
                                    }}>No model response recorded for this prompt.</div>
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    // Fallback: no structured conversation, show raw text as input
                    <div>
                        {sectionLabel('↱ Input', 'var(--indigo-light)')}
                        {msgBox(p.text || '(No prompt text)')}
                        {sectionLabel('↳ Output (Model Response)', 'var(--warn)')}
                        <div style={{
                            padding: '10px 14px',
                            border: '1px dashed rgba(245,158,11,0.25)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            fontStyle: 'italic',
                        }}>No model response recorded for this prompt.</div>
                    </div>
                )}

                <button className="btn btn-secondary" style={{ marginTop: 16, fontSize: 12 }} onClick={copyText}>
                    📋 Copy Prompt
                </button>
            </div>
        </div>
    );
}
