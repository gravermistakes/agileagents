const ChatPage = {
    _pendingContext: '',
    _pendingFileName: '',
    _streaming: false,
    _systemPrompt: 'default',

    MODES: [
        { key: 'default', label: 'Code' },
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

        container.innerHTML = `
            <div class="page active" id="page-chat">
                <div class="chat-container">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <div style="font-size:12px;color:var(--text-muted)">${UI.escapeHtml(AI.PROVIDERS[AI._provider].name)} · ${UI.escapeHtml(model.name)} · ${model.ctx}</div>
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
                        ${this.renderMessages()}
                    </div>
                    ${this._pendingContext ? `
                        <div class="file-context-tag">
                            📎 ${UI.escapeHtml(this._pendingFileName || 'File')}
                            <button onclick="ChatPage._pendingContext='';ChatPage._pendingFileName='';ChatPage.render()">✕</button>
                        </div>
                    ` : ''}
                    <div class="chat-input-area">
                        <textarea id="chat-input"
                                  placeholder="Ask anything..."
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

    renderMessages() {
        if (AI._messages.length === 0) {
            return `
                <div class="empty-state" style="padding:24px 0">
                    <div class="emoji">💬</div>
                    <p>Start a conversation</p>
                    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Powered by ${UI.escapeHtml(AI.PROVIDERS[AI._provider].name)}</p>
                    <div class="quick-prompts">
                        ${this.QUICK_PROMPTS.map(p =>
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
        document.querySelectorAll('.chat-mode-pill').forEach(el => {
            el.classList.toggle('active', el.textContent.trim() === this.MODES.find(m => m.key === mode)?.label);
        });
        UI.toast('Mode: ' + this.MODES.find(m => m.key === mode)?.label);
    },

    useQuickPrompt(text) {
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = text;
            input.focus();
        }
    },

    handleKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.send();
        }
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
            await AI.sendStream(text, (chunk, full) => {
                const el = document.getElementById('streaming-msg');
                if (el) {
                    el.querySelector('.content').innerHTML = UI.renderMarkdown(full);
                    this.scrollToBottom();
                }
            }, this._systemPrompt);
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

    scrollToBottom() {
        const el = document.getElementById('chat-messages');
        if (el) el.scrollTop = el.scrollHeight;
    },

    async clearChat() {
        if (AI._messages.length === 0) return;
        if (!confirm('Clear chat history?')) return;
        await AI.clearHistory();
        this.render();
        UI.toast('Chat cleared');
    },
};
