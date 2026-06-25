const SettingsPage = {
    render() {
        const container = document.getElementById('page-container');
        const ghConnected = GitHub.isConnected();
        const aiConnected = AI.isConnected();
        const provider = AI.PROVIDERS[AI._provider];

        container.innerHTML = `
            <div class="page active" id="page-settings">
                <div class="page-header"><h1>Settings</h1></div>

                <div class="card">
                    <div class="card-header">GitHub</div>
                    ${ghConnected ? `
                        <div id="gh-user-info" style="margin-bottom:12px">
                            <span class="badge connected">Connected</span>
                        </div>
                        <button class="btn btn-danger" onclick="SettingsPage.disconnectGitHub()">Disconnect GitHub</button>
                    ` : `
                        <div class="key-input-group">
                            <label>Personal Access Token</label>
                            <input type="password" id="gh-token-input" placeholder="ghp_xxxxx..."
                                   autocomplete="off" spellcheck="false">
                            <div class="key-status" style="color:var(--text-muted);font-size:12px;margin-top:8px">
                                Create at github.com/settings/tokens → Fine-grained → repo access
                            </div>
                        </div>
                        <button class="btn" onclick="SettingsPage.connectGitHub()">Connect</button>
                    `}
                </div>

                <div class="card">
                    <div class="card-header">AI Provider</div>
                    <div class="key-input-group">
                        <label>Provider</label>
                        <select id="provider-select" onchange="SettingsPage.changeProvider(this.value)"
                                style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:12px;font-size:16px">
                            ${Object.entries(AI.PROVIDERS).map(([key, p]) => `
                                <option value="${key}" ${key === AI._provider ? 'selected' : ''}>
                                    ${p.name} (${p.limits})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    ${aiConnected ? `
                        <div style="margin-bottom:12px">
                            <span class="badge connected">Connected</span>
                            <span style="color:var(--text-muted);font-size:13px;margin-left:8px">${AI.getModel().name}</span>
                        </div>
                        ${this._renderModelSelect()}
                        <button class="btn btn-danger" onclick="SettingsPage.disconnectAI()" style="margin-top:8px">Disconnect ${provider.name}</button>
                    ` : `
                        ${AI._provider === 'custom' ? `
                            <div class="key-input-group">
                                <label>Base URL (OpenAI-compatible)</label>
                                <input type="url" id="custom-url-input" placeholder="https://api.example.com/v1"
                                       value="${AI.PROVIDERS.custom.baseUrl || ''}"
                                       autocomplete="off" spellcheck="false">
                            </div>
                        ` : ''}
                        <div class="key-input-group">
                            <label>API Key</label>
                            <input type="password" id="ai-key-input" placeholder="${this._keyPlaceholder()}"
                                   autocomplete="off" spellcheck="false">
                            <div class="key-status" style="color:var(--text-muted);font-size:12px;margin-top:8px">
                                ${this._keyHint()}
                            </div>
                        </div>
                        <button class="btn" onclick="SettingsPage.connectAI()">Connect</button>
                    `}
                </div>

                <div class="card">
                    <div class="card-header">Chat</div>
                    <button class="btn btn-secondary" onclick="SettingsPage.clearChat()">Clear Chat History</button>
                </div>

                <div class="card">
                    <div class="card-header">About</div>
                    <p style="color:var(--text-muted);font-size:13px">
                        PhoneDev v0.2.0<br>
                        Mobile-first developer workspace<br>
                        Built for phone-only developers<br><br>
                        All data stored locally on your device.<br>
                        API keys stored locally in IndexedDB.
                    </p>
                </div>

                <div class="card">
                    <div class="card-header">Data</div>
                    <button class="btn btn-secondary" onclick="SettingsPage.exportData()" style="margin-bottom:8px">Export Data</button>
                    <button class="btn btn-danger" onclick="SettingsPage.clearAll()">Clear All Data</button>
                </div>
            </div>`;

        if (ghConnected) this.loadGitHubUser();
    },

    _renderModelSelect() {
        const models = AI.getProviderModels();
        if (!models.length) return '';
        return `
            <div class="key-input-group">
                <label>Model</label>
                <select id="model-select" onchange="SettingsPage.changeModel(this.value)"
                        style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:12px;font-size:16px">
                    ${models.map(m => `
                        <option value="${m.id}" ${m.id === AI._model ? 'selected' : ''}>
                            ${m.name} (${m.ctx})
                        </option>
                    `).join('')}
                </select>
            </div>`;
    },

    _keyPlaceholder() {
        const hints = { groq: 'gsk_xxxxx...', openrouter: 'sk-or-...', mistral: 'xxx...', gemini: 'AIza...', custom: 'sk-...' };
        return hints[AI._provider] || 'API key...';
    },

    _keyHint() {
        const hints = {
            groq: 'Free at console.groq.com → API Keys',
            openrouter: 'Free at openrouter.ai → Keys',
            mistral: 'Free at console.mistral.ai → API Keys',
            gemini: 'Free at aistudio.google.com → API keys',
            custom: 'Enter your provider\'s API key',
        };
        return hints[AI._provider] || '';
    },

    async loadGitHubUser() {
        try {
            const user = await GitHub.getUser();
            const el = document.getElementById('gh-user-info');
            if (el) {
                el.innerHTML = `
                    <div style="display:flex;align-items:center;gap:10px">
                        <img src="${UI.escapeAttr(user.avatar_url)}" style="width:32px;height:32px;border-radius:50%">
                        <div>
                            <div style="font-weight:600">${UI.escapeHtml(user.login)}</div>
                            <div style="font-size:12px;color:var(--text-muted)">${user.public_repos} repos</div>
                        </div>
                        <span class="badge connected" style="margin-left:auto">Connected</span>
                    </div>`;
            }
        } catch {}
    },

    async connectGitHub() {
        const input = document.getElementById('gh-token-input');
        const token = input.value.trim();
        if (!token) { UI.toast('Enter a token'); return; }

        try {
            await GitHub.setToken(token);
            await GitHub.getUser();
            UI.toast('GitHub connected!');
            this.render();
        } catch (e) {
            await GitHub.clearToken();
            UI.toast('Invalid token: ' + e.message);
        }
    },

    async disconnectGitHub() {
        await GitHub.clearToken();
        UI.toast('GitHub disconnected');
        this.render();
    },

    async changeProvider(providerId) {
        await AI.setProvider(providerId);
        this.render();
    },

    async connectAI() {
        const input = document.getElementById('ai-key-input');
        const key = input.value.trim();
        if (!key) { UI.toast('Enter a key'); return; }

        if (AI._provider === 'custom') {
            const urlInput = document.getElementById('custom-url-input');
            const baseUrl = urlInput ? urlInput.value.trim() : '';
            if (!baseUrl) { UI.toast('Enter a base URL'); return; }
            await AI.setCustomBaseUrl(baseUrl);
        }

        try {
            await AI.setKey(key);
            const provider = AI.PROVIDERS[AI._provider];

            if (provider.isGemini) {
                const res = await fetch(`${provider.baseUrl}/models?key=${key}`);
                if (!res.ok) throw new Error(`${res.status}`);
            } else if (provider.validatePath) {
                const base = provider.baseUrl || AI.PROVIDERS.custom.baseUrl;
                const res = await fetch(base + provider.validatePath, {
                    headers: { 'Authorization': `Bearer ${key}` },
                });
                if (!res.ok) throw new Error(`${res.status}`);
            }

            UI.toast(`${provider.name} connected!`);
            this.render();
        } catch (e) {
            await AI.clearKey();
            UI.toast('Invalid key: ' + e.message);
        }
    },

    async disconnectAI() {
        await AI.clearKey();
        UI.toast('Disconnected');
        this.render();
    },

    async changeModel(modelId) {
        await AI.setModel(modelId);
        UI.toast('Model: ' + AI.getModel().name);
    },

    async clearChat() {
        if (confirm('Clear all chat history?')) {
            await AI.clearHistory();
            UI.toast('Chat history cleared');
        }
    },

    exportData() {
        const data = {
            chatHistory: AI._messages,
            provider: AI._provider,
            model: AI._model,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'phonedev-export.json';
        a.click();
        URL.revokeObjectURL(url);
        UI.toast('Exported!');
    },

    async clearAll() {
        if (confirm('Delete all data? This cannot be undone.')) {
            await GitHub.clearToken();
            await AI.clearKey();
            await AI.clearHistory();
            indexedDB.deleteDatabase('phonedev');
            UI.toast('All data cleared');
            location.reload();
        }
    },
};
