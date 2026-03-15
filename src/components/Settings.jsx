import React, { useState, useEffect } from 'react';
import { getGitHubConfig, setGitHubConfig, getOpenAIKey, setOpenAIKey, testConnection } from '../api';
import { useToast } from '../App';

export default function Settings({ onSaved }) {
    const [owner, setOwner] = useState('');
    const [repo, setRepo] = useState('');
    const [pat, setPat] = useState('');
    const [branch, setBranch] = useState('main');
    const [openaiKey, setOpenaiKey] = useState('');
    const [testing, setTesting] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        const cfg = getGitHubConfig();
        setOwner(cfg.owner);
        setRepo(cfg.repo);
        setPat(cfg.pat);
        setBranch(cfg.branch);
        setOpenaiKey(getOpenAIKey());
    }, []);

    function handleSave(e) {
        e.preventDefault();
        setGitHubConfig({ owner, repo, pat, branch });
        setOpenAIKey(openaiKey);
        addToast('Settings saved', 'success', '💾');
        if (onSaved) onSaved();
    }

    async function handleTest() {
        if (!owner || !repo) {
            addToast('Please enter a GitHub owner and repo first', 'warn', '⚠️');
            return;
        }
        setTesting(true);
        try {
            await testConnection();
            addToast('Connected to repo successfully!', 'success', '✅');
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
                <p>Connect to your GitHub repository — prompts are stored as <code>prompts.json</code> in the repo</p>
            </div>

            <div className="card" style={{ maxWidth: 640 }}>
                <form onSubmit={handleSave}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="gh-owner">GitHub Owner</label>
                            <input
                                id="gh-owner"
                                className="form-input"
                                type="text"
                                placeholder="username or org"
                                value={owner}
                                onChange={e => setOwner(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="gh-repo">Repository</label>
                            <input
                                id="gh-repo"
                                className="form-input"
                                type="text"
                                placeholder="prompt-bank"
                                value={repo}
                                onChange={e => setRepo(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="gh-pat">Personal Access Token</label>
                        <input
                            id="gh-pat"
                            className="form-input"
                            type="password"
                            placeholder="ghp_..."
                            value={pat}
                            onChange={e => setPat(e.target.value)}
                        />
                        <p className="form-help">
                            Required for write operations (add, edit, delete). Read access to public repos works without a token.
                            Create a fine-grained PAT with <strong>Contents: Read and write</strong> permission on this repo.
                        </p>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="gh-branch">Branch</label>
                        <input
                            id="gh-branch"
                            className="form-input"
                            type="text"
                            placeholder="main"
                            value={branch}
                            onChange={e => setBranch(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="openai-key">OpenAI API Key (Optional)</label>
                        <input
                            id="openai-key"
                            className="form-input"
                            type="password"
                            placeholder="sk-..."
                            value={openaiKey}
                            onChange={e => setOpenaiKey(e.target.value)}
                        />
                        <p className="form-help">Used for semantic (embedding-based) search in the Search page.</p>
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
                    <li>Create a GitHub repository (or use this one).</li>
                    <li>Make sure <code>prompts.json</code> exists at the root of the repo.</li>
                    <li>
                        Create a <strong>fine-grained Personal Access Token</strong> at{' '}
                        <strong>GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens</strong>.
                        Set <strong>Repository access</strong> to this repo and grant <strong>Contents: Read and write</strong>.
                    </li>
                    <li>Enter the owner, repo name, and PAT above, then click <strong>Save Settings</strong>.</li>
                    <li>Click <strong>Test Connection</strong> to verify everything works.</li>
                </ol>
            </div>
        </div>
    );
}
