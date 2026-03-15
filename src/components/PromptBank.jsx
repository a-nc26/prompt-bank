import React, { useState, useMemo } from 'react';
import { usePrompts, useToast } from '../App';
import { updateRating, deletePrompt } from '../api';
import { categoryColor, ratingColor, scoreLabel, ABUSE_AREAS, normalizeConversation, isMultiTurnPrompt } from '../utils';

export default function PromptBank() {
    const { prompts, setPrompts, loading, reload } = usePrompts();
    const addToast = useToast();

    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [rating, setRating] = useState('all');
    const [turnType, setTurnType] = useState('all');
    const [abuseArea, setAbuseArea] = useState('all');
    const [selected, setSelected] = useState(null); // for detail modal

    const filtered = useMemo(() => {
        return prompts.filter(p => {
            if (search) {
                const q = search.toLowerCase();
                if (!p.text?.toLowerCase().includes(q) && !p.abuseArea?.toLowerCase().includes(q)) return false;
            }
            if (category !== 'all') {
                if (!p.category?.toLowerCase().includes(category.toLowerCase())) return false;
            }
            if (rating !== 'all' && p.rating?.toLowerCase() !== rating.toLowerCase()) return false;
            if (turnType !== 'all') {
                const tt = p.turnType?.toLowerCase() || '';
                if (!tt.includes(turnType.toLowerCase().replace('-turn', ''))) return false;
            }
            if (abuseArea !== 'all' && p.abuseArea !== abuseArea) return false;
            return true;
        });
    }, [prompts, search, category, rating, turnType, abuseArea]);

    async function handleRatingChange(id, newRating) {
        try {
            await updateRating(id, newRating);
            setPrompts(prev => prev.map(p => p.id === id ? { ...p, rating: newRating } : p));
            addToast('Rating updated', 'success', '✅');
        } catch (e) {
            addToast('Failed to update: ' + e.message, 'error', '⚠️');
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Delete this prompt?')) return;
        try {
            await deletePrompt(id);
            setPrompts(prev => prev.filter(p => p.id !== id));
            setSelected(null);
            addToast('Prompt deleted', 'success', '🗑️');
        } catch (e) {
            addToast('Failed to delete: ' + e.message, 'error', '⚠️');
        }
    }

    const uniqueAreas = useMemo(() => {
        const s = new Set(prompts.map(p => p.abuseArea).filter(Boolean));
        return [...s].sort();
    }, [prompts]);

    return (
        <div className="page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>Prompt Bank</h2>
                    <p>{filtered.length} of {prompts.length} prompts</p>
                </div>
                <button className="btn btn-secondary" onClick={reload} style={{ marginTop: 4 }}>
                    🔄 Refresh
                </button>
            </div>

            {/* Search */}
            <div className="search-bar-wrap">
                <span className="search-icon">🔍</span>
                <input
                    id="prompt-bank-search"
                    className="search-input"
                    placeholder="Filter by keyword…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Filters */}
            <div className="filter-row">
                {/* Category */}
                {['all', 'security', 'trust'].map(c => (
                    <button
                        key={c}
                        className={`filter-btn ${category === c ? 'active' : ''}`}
                        onClick={() => setCategory(c)}
                    >
                        {c === 'all' ? 'All Categories' : c === 'security' ? '🔒 Security' : '🛡️ Trust & Safety'}
                    </button>
                ))}

                <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />

                {/* Rating */}
                {['all', 'unsafe', 'safe'].map(r => (
                    <button
                        key={r}
                        className={`filter-btn ${rating === r ? 'active' : ''}`}
                        onClick={() => setRating(r)}
                    >
                        {r === 'all' ? 'All Ratings' : r === 'unsafe' ? '🔴 Unsafe' : '🟢 Safe'}
                    </button>
                ))}

                <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />

                {/* Turn type */}
                {['all', 'single', 'multi'].map(t => (
                    <button
                        key={t}
                        className={`filter-btn ${turnType === t ? 'active' : ''}`}
                        onClick={() => setTurnType(t)}
                    >
                        {t === 'all' ? 'All Turns' : t === 'single' ? '↱ Single-turn' : '↻ Multi-turn'}
                    </button>
                ))}

                <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />

                {/* Abuse area */}
                <select
                    className="select-filter"
                    value={abuseArea}
                    onChange={e => setAbuseArea(e.target.value)}
                    id="abuse-area-filter"
                >
                    <option value="all">All Abuse Areas</option>
                    {uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>

            {/* Prompts list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 12px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3>No prompts found</h3>
                    <p>Try adjusting the filters or upload a CSV to get started.</p>
                </div>
            ) : (
                <div className="prompts-grid">
                    {filtered.map(p => (
                        <PromptCard
                            key={p.id}
                            prompt={p}
                            onClick={() => setSelected(p)}
                        />
                    ))}
                </div>
            )}

            {/* Detail modal */}
            {selected && (
                <PromptModal
                    prompt={selected}
                    onClose={() => setSelected(null)}
                    onRatingChange={handleRatingChange}
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
}

function PromptCard({ prompt: p, onClick }) {
    const isMulti = isMultiTurnPrompt(p);
    const score = scoreLabel(p.score);
    const hasResponse = !!(p.conversation && p.conversation !== 'null' && p.conversation !== '');

    return (
        <div className="prompt-card" onClick={onClick} id={`prompt-${p.id}`}>
            <div className="prompt-card-header">
                <div className="prompt-badges">
                    <span className={`badge ${ratingColor(p.rating)}`}>
                        {p.rating?.toLowerCase() === 'unsafe' ? '🔴' : '🟢'} {p.rating || 'Unrated'}
                    </span>
                    <span className={`badge ${categoryColor(p.category)}`}>
                        {p.category || 'Uncategorized'}
                    </span>
                    <span className={`badge ${isMulti ? 'multi' : 'single'}`}>
                        {isMulti ? '↻ Multi-turn' : '↱ Single-turn'}
                    </span>
                    {hasResponse && <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>↳ Has response</span>}
                    {score && <span className="score-badge">{score}</span>}
                </div>
            </div>

            <div className="prompt-text">
                {p.text || '(No prompt text)'}
            </div>

            <div className="prompt-card-footer">
                <span className="abuse-area-tag">{p.abuseArea || 'Unknown area'}</span>
                <span className="prompt-meta">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}</span>
            </div>
        </div>
    );
}

function PromptModal({ prompt: p, onClose, onRatingChange, onDelete }) {
    const isMulti = isMultiTurnPrompt(p);
    const conversation = normalizeConversation(p);

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
                        {p.rating?.toLowerCase() === 'unsafe' ? '🔴' : '🟢'} {p.rating || 'Unrated'}
                    </span>
                    <span className={`badge ${categoryColor(p.category)}`}>{p.category}</span>
                    <span className={`badge ${isMulti ? 'multi' : 'single'}`}>
                        {isMulti ? '↻ Multi-turn' : '↱ Single-turn'}
                    </span>
                    {p.abuseArea && <span className="badge neutral">{p.abuseArea}</span>}
                    {scoreLabel(p.score) && <span className="score-badge">{scoreLabel(p.score)}</span>}
                </div>

                {conversation ? (
                    isMulti ? (
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

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn btn-secondary"
                            style={{ fontSize: 12 }}
                            onClick={() => onRatingChange(p.id, p.rating === 'unsafe' ? 'safe' : 'unsafe')}
                        >
                            {p.rating === 'unsafe' ? '🟢 Mark Safe' : '🔴 Mark Unsafe'}
                        </button>
                    </div>
                    <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => onDelete(p.id)}>
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
