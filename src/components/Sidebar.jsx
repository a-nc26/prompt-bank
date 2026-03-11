import React from 'react';

const NAV = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'bank', icon: '🗃️', label: 'Prompt Bank' },
    { id: 'search', icon: '🔍', label: 'Similarity Search' },
    { id: 'upload', icon: '⬆️', label: 'Upload CSV' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export default function Sidebar({ activePage, onNavigate }) {
    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <h1>Prompt Bank</h1>
                <p>GenAI Red-Teaming</p>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section-label">Navigation</div>
                {NAV.map(item => (
                    <button
                        key={item.id}
                        className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                        onClick={() => onNavigate(item.id)}
                        id={`nav-${item.id}`}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    <div>🔒 Data lives in Google Sheets</div>
                    <div>🤖 AI classification via OpenAI</div>
                </div>
            </div>
        </aside>
    );
}
