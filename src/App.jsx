import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import './index.css';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PromptBank from './components/PromptBank';
import Search from './components/Search';
import Upload from './components/Upload';
import Settings from './components/Settings';
import { fetchPrompts, getScriptUrl } from './api';

// ── Toast Context ─────────────────────────────────────────
export const ToastContext = createContext(null);
export const PromptsContext = createContext(null);

export function useToast() { return useContext(ToastContext); }
export function usePrompts() { return useContext(PromptsContext); }

// ── Toast Component ───────────────────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.icon}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

const PAGES = ['dashboard', 'bank', 'search', 'upload', 'settings'];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  // ── Toast helper ──────────────────────────────────────
  const addToast = useCallback((message, type = 'info', icon = '💬') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, icon }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Load prompts ──────────────────────────────────────
  const loadPrompts = useCallback(async () => {
    const url = getScriptUrl();
    if (!url) return;
    setLoading(true);
    try {
      const data = await fetchPrompts();
      setPrompts(Array.isArray(data) ? data : data.prompts || []);
    } catch (e) {
      addToast('Could not load prompts: ' + e.message, 'error', '⚠️');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  return (
    <ToastContext.Provider value={addToast}>
      <PromptsContext.Provider value={{ prompts, setPrompts, loading, reload: loadPrompts }}>
        <div className="app-layout">
          <Sidebar activePage={page} onNavigate={setPage} />
          <main className="main-content">
            {page === 'dashboard' && <Dashboard />}
            {page === 'bank' && <PromptBank />}
            {page === 'search' && <Search />}
            {page === 'upload' && <Upload onDone={() => { loadPrompts(); setPage('bank'); }} />}
            {page === 'settings' && <Settings onSaved={loadPrompts} />}
          </main>
        </div>
        <ToastContainer toasts={toasts} />
      </PromptsContext.Provider>
    </ToastContext.Provider>
  );
}
