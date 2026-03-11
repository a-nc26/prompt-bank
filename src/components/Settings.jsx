import React, { useState, useEffect } from 'react';
import { getScriptUrl, setScriptUrl, getOpenAIKey, setOpenAIKey, getDirectConnection, setDirectConnection, testConnection } from '../api';
import { useToast } from '../App';

export default function Settings({ onSaved }) {
    const [url, setUrl] = useState('');
    const [key, setKey] = useState('');
    const [direct, setDirect] = useState(false);
    const [testing, setTesting] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        setUrl(getScriptUrl());
        setKey(getOpenAIKey());
        setDirect(getDirectConnection());
    }, []);

    async function handleSave(e) {
        e.preventDefault();
        setScriptUrl(url);
        setOpenAIKey(key);
        setDirectConnection(direct);
        addToast('Settings saved to local storage', 'success', '💾');
        if (onSaved) onSaved();
    }

    async function handleTest() {
        if (!url) {
            addToast('Please enter a Script URL first', 'warn', '⚠️');
            return;
        }
        setTesting(true);
        try {
            const res = await testConnection();
            if (res.status === 'ok' || res.message === 'pong') {
                addToast('Connection successful!', 'success', '✅');
            } else {
                addToast('Unexpected response from script', 'warn', '❓');
            }
        } catch (e) {
            addToast('Connection failed: ' + e.message, 'error', '❌');
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="page" id="settings-page">
            <div className="page-header">
                <h2>Settings</h2>
                <p>Configure your connection to the Google Sheets backend</p>
            </div>

            <div className="card" style={{ maxWidth: 640 }}>
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="script-url">Google Apps Script URL</label>
                        <input
                            id="script-url"
                            className="form-input"
                            type="url"
                            placeholder="https://script.google.com/macros/s/.../exec"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            required
                        />
                        <p className="form-help">
                            The "Web App" URL from your Apps Script project. Must end with <code>/exec</code> (not /dev).
                        </p>
                        {url && (
                            <p className="form-help" style={{ marginTop: 4 }}>
                                <a href={url + (url.includes('?') ? '&' : '?') + 'action=ping'} target="_blank" rel="noopener noreferrer">
                                    Open URL in new tab
                                </a>
                                {' '}— you should see {"{ \"status\": \"ok\", \"message\": \"pong\" }"}. If you see "Failed to fetch", check the URL or open the app in the same browser where you’re logged into Google (for "Only myself" deployments).
                            </p>
                        )}
                    </div>

                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            id="direct-connection"
                            type="checkbox"
                            checked={direct}
                            onChange={e => setDirect(e.target.checked)}
                        />
                        <label className="form-label" htmlFor="direct-connection" style={{ marginBottom: 0 }}>
                            Direct connection (for &quot;Only myself&quot; — browser sends your Google login; may hit CORS in some browsers)
                        </label>
                    </div>
                    <p className="form-help" style={{ marginTop: -4, marginBottom: 16 }}>
                        If you get a login-page error when loading prompts, turn this on, save, and reload the app. Otherwise leave off.
                    </p>

                    <div className="form-group">
                        <label className="form-label" htmlFor="openai-key">OpenAI API Key (Optional)</label>
                        <input
                            id="openai-key"
                            className="form-input"
                            type="password"
                            placeholder="sk-..."
                            value={key}
                            onChange={e => setKey(e.target.value)}
                        />
                        <p className="form-help">
                            Used for auto-classification and embeddings if enabled in your script.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                        <button type="submit" className="btn btn-primary" id="save-settings">
                            💾 Save Settings
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleTest}
                            disabled={testing}
                            id="test-connection"
                        >
                            {testing ? <span className="spinner" /> : '🔌 Test Connection'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="card" style={{ maxWidth: 640, marginTop: 24, border: '1px solid var(--indigo-dim)' }}>
                <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--indigo-light)' }}>Setup Instructions</h3>
                <ol style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 20, lineHeight: 1.8 }}>
                    <li>Create a new Google Sheet.</li>
                    <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
                    <li>Copy the backend code into the editor.</li>
                    <li>Click <strong>Deploy &gt; New Deployment</strong>.</li>
                    <li>Select <strong>Web App</strong>. If your org allows it, set access to <strong>"Anyone"</strong>. Otherwise use <strong>"Only myself"</strong> and stay logged into that Google account in this browser.</li>
                    <li>Copy the URL and paste it above.</li>
                </ol>
            </div>
        </div>
    );
}
