import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { addPrompts } from '../api';
import { useToast } from '../App';
import { genId, normalizeConversation } from '../utils';

export default function Upload({ onDone }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [uploading, setUploading] = useState(false);
    const addToast = useToast();

    const onFileChange = (e) => {
        const f = e.target.files[0];
        if (f) processFile(f);
    };

    const processFile = (file) => {
        setFile(file);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                // Map common CSV headers to our schema
                const mapped = results.data.map(row => {
                    const conversation = normalizeConversation(row);
                    return {
                        id: genId(),
                        text: row.text || row.prompt || row.Prompt || row.Content || row.userPrompt || row.input || '',
                        category: row.category || row.Category || row.type || 'Trust & Safety',
                        abuseArea: row.abuseArea || row.AbuseArea || row.area || row.Area || '',
                        rating: row.rating?.toLowerCase() === 'unsafe' ? 'unsafe' : 'safe',
                        turnType: row.turnType || row.TurnType || (conversation ? 'multi-turn' : 'single-turn'),
                        score: parseFloat(row.score || row.Score) || 0,
                        conversation: conversation ? JSON.stringify(conversation) : null,
                        createdAt: new Date().toISOString()
                    };
                }).filter(p => p.text || p.conversation);

                setPreview(mapped);
            },
            error: (err) => {
                addToast('Error parsing CSV: ' + err.message, 'error', '❌');
            }
        });
    };

    async function handleUpload() {
        if (!preview.length) return;
        setUploading(true);
        try {
            await addPrompts(preview);
            addToast(`Successfully uploaded ${preview.length} prompts`, 'success', '🚀');
            if (onDone) onDone();
        } catch (e) {
            addToast('Upload failed: ' + e.message, 'error', '❌');
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="page" id="upload-page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>Upload CSV</h2>
                    <p>Import multiple prompts at once from a CSV file</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={() => {
                        const headers = "text,category,abuseArea,rating,turnType,score,conversation\n";
                        const example = "\"Example jailbreak prompt\",\"Security\",\"Jailbreak\",\"unsafe\",\"single-turn\",0.8,\n";
                        const blob = new Blob([headers + example], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'prompt_bank_template.csv';
                        a.click();
                    }}
                    style={{ marginTop: 4 }}
                >
                    📥 Download Template
                </button>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', border: '2px dashed var(--border)' }}>
                {!file ? (
                    <div>
                        <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
                        <h3 style={{ marginBottom: 8 }}>Select a CSV File</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                            Make sure your CSV has headers like "text", "category", and "abuseArea"
                        </p>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={onFileChange}
                            style={{ display: 'none' }}
                            id="csv-upload"
                        />
                        <label htmlFor="csv-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>
                            Choose File
                        </label>
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 600 }}>{file.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{preview.length} prompts detected</div>
                            </div>
                            <button className="btn btn-secondary" onClick={() => { setFile(null); setPreview([]); }} style={{ padding: '6px 12px', fontSize: 12 }}>
                                Change
                            </button>
                        </div>

                        <div style={{ maxHeight: 300, overflow: 'auto', textAlign: 'left', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 20, border: '1px solid var(--border)' }}>
                            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Prompt Preview</th>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Category</th>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Area</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.slice(0, 10).map((p, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                            <td style={{ padding: 8, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.text}</td>
                                            <td style={{ padding: 8 }}>{p.category}</td>
                                            <td style={{ padding: 8 }}>{p.abuseArea}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {preview.length > 10 && (
                                <div style={{ textAlign: 'center', padding: 8, color: 'var(--text-muted)', fontSize: 10 }}>
                                    + {preview.length - 10} more rows...
                                </div>
                            )}
                        </div>

                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', maxWidth: 300 }}
                            onClick={handleUpload}
                            disabled={uploading}
                            id="confirm-upload"
                        >
                            {uploading ? <><span className="spinner" /> Uploading...</> : `Upload ${preview.length} Prompts`}
                        </button>
                    </div>
                )}
            </div>

            <div className="card" style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12 }}>CSV Schema Requirements</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                    <SchemaChip label="text" required />
                    <SchemaChip label="category" />
                    <SchemaChip label="abuseArea" />
                    <SchemaChip label="rating" />
                    <SchemaChip label="turnType" />
                    <SchemaChip label="score" />
                    <SchemaChip label="conversation" />
                </div>
                <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                    * <strong>conversation</strong> should be a JSON string for multi-turn prompts: <code>{'[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]'}</code>
                </p>
            </div>
        </div>
    );
}

function SchemaChip({ label, required }) {
    return (
        <div style={{
            padding: '8px 12px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            {label}
            {required && <span style={{ color: 'var(--danger)', fontSize: 16, lineHeight: 1 }}>*</span>}
        </div>
    );
}
