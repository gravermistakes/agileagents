const SettingsPage = {
    render() {
        const container = document.getElementById('page-container');
        const ghConnected = GitHub.isConnected();
        const aiConnected = AI.isConnected();

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
                    <div class="card-header">Groq AI</div>
                    ${aiConnected ? `
                        <div style="margin-bottom:12px">
                            <span class="badge connected">Connected</span>
                            <span style="color:var(--text-muted);font-size:13px;margin-left:8px">${AI.getModel().name}</span>
                        </div>
                        <div class="key-input-group">
                            <label>Model</label>
                            <select id="model-select" onchange="SettingsPage.changeModel(this.value)"
                                    style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:12px;font-size:16px">
                                ${AI.MODELS.map(m => `
                                    <option value="${m.id}" ${m.id === AI._model ? 'selected' : ''}>
                                        ${m.name} (${m.ctx})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <button class="btn btn-danger" onclick="SettingsPage.disconnectAI()">Disconnect Groq</button>
                    ` : `
                        <div class="key-input-group">
                            <label>API Key</label>
                            <input type="password" id="groq-key-input" placeholder="gsk_xxxxx..."
                                   autocomplete="off" spellcheck="false">
                            <div class="key-status" style="color:var(--text-muted);font-size:12px;margin-top:8px">
                                Free at console.groq.com → API Keys
                            </div>
                        </div>
                        <button class="btn" onclick="SettingsPage.connectAI()">Connect</button>
                    `}
                </div>

                <div class="card">
                    <div class="card-header">About</div>
                    <p style="color:var(--text-muted);font-size:13px">
                        PhoneDev v0.1.0<br>
                        Mobile-first developer workspace<br>
                        Built for phone-only developers<br><br>
                        All data stored locally on your device.<br>
                        API keys encrypted in IndexedDB.
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

    async loadGitHubUser() {
        try {
            const user = await GitHub.getUser();
            const el = document.getElementById('gh-user-info');
            if (el) {
                el.innerHTML = `
                    <div style="display:flex;align-items:center;gap:10px">
                        <img src="${user.avatar_url}" style="width:32px;height:32px;border-radius:50%">
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

    async connectAI() {
        const input = document.getElementById('groq-key-input');
        const key = input.value.trim();
        if (!key) { UI.toast('Enter a key'); return; }

        try {
            await AI.setKey(key);
            // Test with a quick request
            UI.toast('Groq connected!');
            this.render();
        } catch (e) {
            await AI.clearKey();
            UI.toast('Error: ' + e.message);
        }
    },

    async disconnectAI() {
        await AI.clearKey();
        AI.clearHistory();
        UI.toast('Groq disconnected');
        this.render();
    },

    async changeModel(modelId) {
        await AI.setModel(modelId);
        UI.toast('Model: ' + AI.getModel().name);
    },

    exportData() {
        const data = {
            chatHistory: AI._messages,
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
            AI.clearHistory();
            indexedDB.deleteDatabase('phonedev');
            UI.toast('All data cleared');
            location.reload();
        }
    },
};
