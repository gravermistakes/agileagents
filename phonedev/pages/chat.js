const ChatPage = {
    _pendingContext: '',
    _pendingFileName: '',
    _streaming: false,
    _systemPrompt: 'default',
    _pendingEdits: [],

    MODES: [
        { key: 'default', label: 'Code' },
        { key: 'agent', label: 'Agent' },
        { key: 'review', label: 'Review' },
        { key: 'explain', label: 'Explain' },
        { key: 'debug', label: 'Debug' },
    ],

    QUICK_PROMPTS: [
        'Explain this error',
        'Review my code',
        'How do I...',
        'Refactor this',
        'Write tests for',
        'Debug this',
    ],

    AGENT_PROMPTS: [
        'Read the README',
        'List files in this repo',
        'Find bugs in this file',
        'Fix the issue in...',
        'Refactor this function',
        'Add error handling',
    ],

    render() {
        const container = document.getElementById('page-container');

        if (!AI.isConnected()) {
            container.innerHTML = `
                <div class="page active" id="page-chat">
                    <div class="empty-state">
                        <div class="emoji">🤖</div>
                        <p>Add an AI API key in Settings</p>
                        <p style="font-size:13px;color:var(--text-muted)">Groq, Gemini, OpenRouter, Mistral — all free tiers</p>
                        <button class="btn" onclick="App.navigate('settings')">Open Settings</button>
                    </div>
                </div>`;
            return;
        }

        const model = AI.getModel();
        const isAgent = this._systemPrompt === 'agent';
        const prompts = isAgent ? this.AGENT_PROMPTS : this.QUICK_PROMPTS;

        container.innerHTML = `
            <div class="page active" id="page-chat">
                <div class="chat-container">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <div style="font-size:12px;color:var(--text-muted)">${UI.escapeHtml(AI.PROVIDERS[AI._provider].name)} · ${UI.escapeHtml(model.name)}${isAgent ? ' · 🤖 Agent' : ''}</div>
                        <button style="background:none;border:none;color:var(--text-muted);font-size:12px;cursor:pointer;padding:4px 8px"
                                onclick="ChatPage.clearChat()">Clear</button>
                    </div>
                    <div class="chat-modes">
                        ${this.MODES.map(m =>
                            `<button class="chat-mode-pill ${m.key === this._systemPrompt ? 'active' : ''}"
                                     onclick="ChatPage.setMode('${m.key}')">${m.label}</button>`
                        ).join('')}
                    </div>
                    <div class="chat-messages" id="chat-messages">
                        ${this.renderMessages(prompts)}
                    </div>
                    ${this._pendingContext ? `
                        <div class="file-context-tag">
                            📎 ${UI.escapeHtml(this._pendingFileName || 'File')}
                            <button onclick="ChatPage._pendingContext='';ChatPage._pendingFileName='';ChatPage.render()">✕</button>
                        </div>
                    ` : ''}
                    <div class="chat-input-area">
                        <textarea id="chat-input"
                                  placeholder="${isAgent ? 'Ask the agent to read, edit, or fix code...' : 'Ask anything...'}"
                                  rows="1"
                                  onkeydown="ChatPage.handleKey(event)"
                                  oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                        <button class="send-btn" id="send-btn" onclick="ChatPage.send()" aria-label="Send">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        </button>
                    </div>
                </div>
            </div>`;

        this.scrollToBottom();
    },

    renderMessages(prompts) {
        if (AI._messages.length === 0) {
            const isAgent = this._systemPrompt === 'agent';
            return `
                <div class="empty-state" style="padding:24px 0">
                    <div class="emoji">${isAgent ? '🤖' : '💬'}</div>
                    <p>${isAgent ? 'Agent mode — AI can read & edit your repos' : 'Start a conversation'}</p>
                    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
                        ${isAgent
                            ? (GitHub.isConnected() ? 'Connected to GitHub — agent has repo access' : '⚠️ Connect GitHub in Settings for agent to work')
                            : 'Powered by ' + UI.escapeHtml(AI.PROVIDERS[AI._provider].name)}
                    </p>
                    <div class="quick-prompts">
                        ${(prompts || this.QUICK_PROMPTS).map(p =>
                            `<button class="quick-prompt-chip" onclick="ChatPage.useQuickPrompt('${UI.escapeAttr(p)}')">${UI.escapeHtml(p)}</button>`
                        ).join('')}
                    </div>
                </div>`;
        }

        return AI._messages.map(msg => `
            <div class="chat-msg ${msg.role}">
                <div class="role">${msg.role === 'user' ? 'You' : 'AI'}</div>
                <div class="content">${UI.renderMarkdown(msg.content)}</div>
            </div>
        `).join('');
    },

    setMode(mode) {
        this._systemPrompt = mode;
        this.render();
        UI.toast('Mode: ' + this.MODES.find(m => m.key === mode)?.label);
    },

    useQuickPrompt(text) {
        const input = document.getElementById('chat-input');
        if (input) { input.value = text; input.focus(); }
    },

    handleKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    },

    async send() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        if (!input || this._streaming) return;

        let text = input.value.trim();
        if (!text) return;

        if (this._pendingContext) {
            text = this._pendingContext + text;
            this._pendingContext = '';
            this._pendingFileName = '';
        }

        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;
        this._streaming = true;

        const messages = document.getElementById('chat-messages');
        messages.innerHTML += `
            <div class="chat-msg user">
                <div class="role">You</div>
                <div class="content">${UI.renderMarkdown(text)}</div>
            </div>
            <div class="chat-msg assistant" id="streaming-msg">
                <div class="role">AI</div>
                <div class="content"><span class="spinner"></span></div>
            </div>`;
        this.scrollToBottom();

        try {
            if (this._systemPrompt === 'agent') {
                await this._sendAgent(text);
            } else {
                await this._sendStream(text);
            }
        } catch (e) {
            const el = document.getElementById('streaming-msg');
            if (el) {
                el.querySelector('.content').innerHTML =
                    `<span style="color:var(--red)">${UI.escapeHtml(e.message)}</span>`;
            }
            if (AI._messages.length > 0 && AI._messages[AI._messages.length - 1].role === 'user') {
                AI._messages.pop();
            }
        }

        this._streaming = false;
        sendBtn.disabled = false;
        input.focus();
    },

    async _sendStream(text) {
        await AI.sendStream(text, (chunk, full) => {
            const el = document.getElementById('streaming-msg');
            if (el) {
                el.querySelector('.content').innerHTML = UI.renderMarkdown(full);
                this.scrollToBottom();
            }
        }, this._systemPrompt);
    },

    async _sendAgent(text) {
        const el = document.getElementById('streaming-msg');
        let toolLog = '';

        const reply = await AI.sendAgentic(text, (type, data) => {
            if (!el) return;
            if (type === 'thinking') {
                el.querySelector('.content').innerHTML = toolLog + '<div class="agent-thinking"><span class="spinner"></span> Thinking...</div>';
            } else if (type === 'tool_call') {
                toolLog += `<div class="tool-call-entry">
                    <div class="tool-call-header">🔧 ${UI.escapeHtml(data.name)}</div>
                    <div class="tool-call-args">${UI.escapeHtml(this._formatToolArgs(data.args))}</div>
                </div>`;
                el.querySelector('.content').innerHTML = toolLog + '<div class="agent-thinking"><span class="spinner"></span> Running...</div>';
                this.scrollToBottom();
            } else if (type === 'tool_result') {
                const lastEntry = el.querySelectorAll('.tool-call-entry');
                if (lastEntry.length > 0) {
                    const entry = lastEntry[lastEntry.length - 1];
                    const preview = typeof data.result === 'string' ? data.result.slice(0, 200) : JSON.stringify(data.result).slice(0, 200);
                    entry.innerHTML += `<div class="tool-call-result">${UI.escapeHtml(preview)}${data.result.length > 200 ? '...' : ''}</div>`;
                }
                this.scrollToBottom();
            }
        });

        if (el) {
            el.querySelector('.content').innerHTML = toolLog + UI.renderMarkdown(reply);
            this._renderPendingEdits(el);
            this.scrollToBottom();
        }
    },

    _formatToolArgs(args) {
        if (args.owner && args.repo && args.path) return `${args.owner}/${args.repo}/${args.path}`;
        if (args.owner && args.repo) return `${args.owner}/${args.repo}/${args.path || ''}`;
        return Object.entries(args).map(([k, v]) => `${k}: ${typeof v === 'string' && v.length > 50 ? v.slice(0, 50) + '...' : v}`).join(', ');
    },

    _renderPendingEdits(msgEl) {
        const pending = this._pendingEdits.filter(e => e.status === 'pending');
        if (!pending.length) return;

        let html = '';
        for (const edit of pending) {
            const diff = ReposPage._simpleDiff(edit.oldContent, edit.newContent);
            html += `
                <div class="edit-proposal" id="edit-${edit.id}">
                    <div class="edit-proposal-header">
                        📝 Edit proposed: <strong>${UI.escapeHtml(edit.path)}</strong>
                        <span style="color:var(--text-muted);font-size:12px">${UI.escapeHtml(edit.message)}</span>
                    </div>
                    <div class="diff-view" style="max-height:200px;overflow:auto;margin:8px 0">${diff}</div>
                    <div style="display:flex;gap:8px">
                        <button class="btn" onclick="ChatPage.approveEdit(${edit.id})" style="flex:1">✅ Approve & Commit</button>
                        <button class="btn btn-secondary" onclick="ChatPage.rejectEdit(${edit.id})" style="flex:1">❌ Reject</button>
                    </div>
                </div>`;
        }
        msgEl.querySelector('.content').innerHTML += html;
    },

    async approveEdit(editId) {
        const edit = this._pendingEdits.find(e => e.id === editId);
        if (!edit || edit.status !== 'pending') return;

        const el = document.getElementById('edit-' + editId);
        if (el) el.innerHTML = '<div class="agent-thinking"><span class="spinner"></span> Committing...</div>';

        try {
            await GitHub.updateFile(edit.owner, edit.repo, edit.path, edit.newContent, edit.sha, edit.message);
            edit.status = 'approved';
            if (el) el.innerHTML = `<div style="color:var(--green)">✅ Committed: ${UI.escapeHtml(edit.message)}</div>`;
            UI.toast('Committed!');
        } catch (e) {
            edit.status = 'error';
            if (el) el.innerHTML = `<div style="color:var(--red)">❌ Commit failed: ${UI.escapeHtml(e.message)}</div>`;
            UI.toast('Commit failed');
        }
    },

    rejectEdit(editId) {
        const edit = this._pendingEdits.find(e => e.id === editId);
        if (!edit) return;
        edit.status = 'rejected';
        const el = document.getElementById('edit-' + editId);
        if (el) el.innerHTML = '<div style="color:var(--text-muted)">Edit rejected</div>';
        UI.toast('Edit rejected');
    },

    scrollToBottom() {
        const el = document.getElementById('chat-messages');
        if (el) el.scrollTop = el.scrollHeight;
    },

    async clearChat() {
        if (AI._messages.length === 0) return;
        if (!confirm('Clear chat history?')) return;
        await AI.clearHistory();
        this._pendingEdits = [];
        this.render();
        UI.toast('Chat cleared');
    },
};
