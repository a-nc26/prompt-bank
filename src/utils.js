// utils.js — Shared helpers

export function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function truncate(str, n = 120) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '…' : str;
}

export function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function genId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export const CATEGORIES = ['Security', 'Trust & Safety'];
export const ABUSE_AREAS = [
    'Jailbreak',
    'Prompt Injection',
    'Malicious Content',
    'Hate Speech',
    'Self-Harm',
    'CSAM',
    'Disinformation',
    'Privacy Violation',
    'Financial Fraud',
    'Dangerous Instructions',
    'Manipulation',
    'Bias',
    'Other',
];

export const TURN_TYPES = ['Single-turn', 'Multi-turn'];

export function categoryColor(cat) {
    if (!cat) return 'neutral';
    if (cat.toLowerCase().includes('security')) return 'security';
    if (cat.toLowerCase().includes('trust') || cat.toLowerCase().includes('safety')) return 'trust';
    return 'neutral';
}

export function ratingColor(r) {
    if (!r) return 'neutral';
    return r.toLowerCase() === 'unsafe' ? 'unsafe' : 'safe';
}

export function scoreLabel(score) {
    if (score === undefined || score === null) return null;
    if (score === -1) return '-1';
    if (score >= 1) return `x${score}`;
    return String(score);
}

function roleToUi(role) {
    const r = String(role || '').toLowerCase();
    if (r === 'human') return 'user';
    if (r === 'model' || r === 'agent' || r === 'bot' || r === 'ai') return 'assistant';
    if (r === 'user' || r === 'assistant' || r === 'system') return r;
    return 'assistant';
}

function msgContent(msg) {
    if (msg == null) return '';
    if (typeof msg === 'string') return msg.trim();
    if (typeof msg !== 'object') return String(msg).trim();
    return String(
        msg.content ??
        msg.text ??
        msg.message ??
        msg.value ??
        msg.prompt ??
        msg.response ??
        ''
    ).trim();
}

function normalizeMessage(msg) {
    const content = msgContent(msg);
    if (!content) return null;
    if (typeof msg === 'string') return { role: 'assistant', content };
    const role = roleToUi(msg.role ?? msg.speaker ?? msg.from ?? msg.author ?? msg.type);
    return { role, content };
}

function parseLabeledTranscript(text) {
    const lines = String(text || '').split(/\r?\n/);
    const out = [];
    let current = null;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const m = line.match(/^(user|assistant|model|agent|system|human)\s*[:\-]\s*(.*)$/i);
        if (m) {
            if (current && current.content) out.push(current);
            current = { role: roleToUi(m[1]), content: (m[2] || '').trim() };
            continue;
        }
        if (current) {
            current.content = `${current.content}\n${line}`.trim();
        }
    }
    if (current && current.content) out.push(current);
    return out.length ? out : null;
}

function parseConversationValue(value) {
    if (value == null || value === '') return null;

    if (Array.isArray(value)) {
        const out = value.map(normalizeMessage).filter(Boolean);
        return out.length ? out : null;
    }

    if (typeof value === 'object') {
        if (Array.isArray(value.messages)) return parseConversationValue(value.messages);
        const userText = msgContent(value.user ?? value.prompt ?? value.input);
        const assistantText = msgContent(value.assistant ?? value.response ?? value.output ?? value.answer);
        if (userText || assistantText) {
            const out = [];
            if (userText) out.push({ role: 'user', content: userText });
            if (assistantText) out.push({ role: 'assistant', content: assistantText });
            return out.length ? out : null;
        }
        return null;
    }

    const text = String(value).trim();
    if (!text) return null;

    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('{') && text.endsWith('}'))) {
        try {
            return parseConversationValue(JSON.parse(text));
        } catch {
            // Fall through to transcript parsing.
        }
    }

    return parseLabeledTranscript(text);
}

export function normalizeConversation(record) {
    const source = record || {};
    const raw =
        source.conversation ??
        source.messages ??
        source.chat ??
        source.dialogue ??
        source.history ??
        null;

    let conv = parseConversationValue(raw);

    const userText = msgContent(
        source.text ??
        source.prompt ??
        source.userPrompt ??
        source.user_input ??
        source.input ??
        source.user
    );
    const assistantText = msgContent(
        source.response ??
        source.assistantResponse ??
        source.modelResponse ??
        source.output ??
        source.answer ??
        source.assistant ??
        source.model
    );

    if (!conv || !conv.length) {
        const out = [];
        if (userText) out.push({ role: 'user', content: userText });
        if (assistantText) out.push({ role: 'assistant', content: assistantText });
        conv = out.length >= 2 ? out : null;
    } else if (conv.length === 1 && conv[0].role === 'assistant' && userText) {
        conv = [{ role: 'user', content: userText }, conv[0]];
    }

    return conv && conv.length ? conv : null;
}

export function isMultiTurnPrompt(record) {
    const tt = String(record?.turnType || '').toLowerCase();
    if (tt.includes('multi')) return true;
    const conv = normalizeConversation(record);
    return Array.isArray(conv) && conv.length >= 2;
}
