import React, { useMemo } from 'react';
import { usePrompts } from '../App';
import { ABUSE_AREAS } from '../utils';

export default function Dashboard() {
    const { prompts, loading } = usePrompts();

    const stats = useMemo(() => {
        const total = prompts.length;
        const unsafe = prompts.filter(p => p.rating?.toLowerCase() === 'unsafe').length;
        const safe = prompts.filter(p => p.rating?.toLowerCase() === 'safe').length;
        const security = prompts.filter(p => p.category?.toLowerCase().includes('security')).length;
        const ts = prompts.filter(p => p.category?.toLowerCase().includes('trust') || p.category?.toLowerCase().includes('safety')).length;
        const multi = prompts.filter(p => p.turnType?.toLowerCase() === 'multi-turn' || p.turnType?.toLowerCase() === 'multi').length;

        // Top abuse areas
        const areaCounts = {};
        prompts.forEach(p => {
            if (p.abuseArea) {
                areaCounts[p.abuseArea] = (areaCounts[p.abuseArea] || 0) + 1;
            }
        });
        const topAreas = Object.entries(areaCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return { total, unsafe, safe, security, ts, multi, topAreas };
    }, [prompts]);

    const recent = [...prompts]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    return (
        <div className="page">
            <div className="page-header">
                <h2>Dashboard</h2>
                <p>Overview of your red-teaming prompt bank</p>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 12px' }} />
                    <p>Loading prompts…</p>
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="stats-grid">
                        <StatCard className="total" label="Total Prompts" value={stats.total} sub="in the bank" />
                        <StatCard className="unsafe" label="Unsafe" value={stats.unsafe} sub={`${stats.total ? Math.round(stats.unsafe / stats.total * 100) : 0}% of total`} />
                        <StatCard className="safe" label="Safe" value={stats.safe} sub="rated safe" />
                        <StatCard className="security" label="Security" value={stats.security} sub="security category" />
                        <StatCard className="ts" label="Trust & Safety" value={stats.ts} sub="T&S category" />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                        {/* Turn type breakdown */}
                        <div className="card">
                            <div className="section-title">Turn Type</div>
                            <TurnBreakdown single={stats.total - stats.multi} multi={stats.multi} total={stats.total} />
                        </div>

                        {/* Top abuse areas */}
                        <div className="card">
                            <div className="section-title">Top Abuse Areas</div>
                            {stats.topAreas.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {stats.topAreas.map(([area, count]) => (
                                        <AreaBar key={area} label={area} count={count} max={stats.topAreas[0][1]} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent prompts */}
                    <div className="card">
                        <div className="section-title">Recently Added</div>
                        {recent.length === 0 ? (
                            <div className="empty-state" style={{ padding: '24px 0' }}>
                                <div className="empty-state-icon">📭</div>
                                <h3>No prompts yet</h3>
                                <p>Upload a CSV to get started.</p>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Prompt</th>
                                        <th>Category</th>
                                        <th>Abuse Area</th>
                                        <th>Rating</th>
                                        <th>Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ maxWidth: 320 }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                                                    {p.text?.slice(0, 80)}{p.text?.length > 80 ? '…' : ''}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${p.category?.toLowerCase().includes('security') ? 'security' : 'trust'}`}>
                                                    {p.category || '—'}
                                                </span>
                                            </td>
                                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                                                {p.abuseArea || '—'}
                                            </td>
                                            <td>
                                                <span className={`badge ${p.rating?.toLowerCase() === 'unsafe' ? 'unsafe' : 'safe'}`}>
                                                    {p.rating || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${p.turnType?.toLowerCase().includes('multi') ? 'multi' : 'single'}`}>
                                                    {p.turnType || '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function StatCard({ className, label, value, sub }) {
    return (
        <div className={`stat-card ${className}`}>
            <div className="stat-label">{label}</div>
            <div className={`stat-value ${className}`}>{value}</div>
            <div className="stat-sub">{sub}</div>
        </div>
    );
}

function TurnBreakdown({ single, multi, total }) {
    const singlePct = total ? Math.round(single / total * 100) : 0;
    const multiPct = total ? 100 - singlePct : 0;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Single-turn</span>
                    <span style={{ color: 'var(--text-muted)' }}>{single} ({singlePct}%)</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${singlePct}%`, background: 'var(--indigo)' }} /></div>
            </div>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Multi-turn</span>
                    <span style={{ color: 'var(--text-muted)' }}>{multi} ({multiPct}%)</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${multiPct}%`, background: 'var(--warn)' }} /></div>
            </div>
        </div>
    );
}

function AreaBar({ label, count, max }) {
    const pct = max ? Math.round(count / max * 100) : 0;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 140, flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--indigo), var(--purple))', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 24, textAlign: 'right' }}>{count}</span>
        </div>
    );
}
