const AppsPage = {
    SERVICES: [
        {
            id: 'discord',
            name: 'Discord',
            icon: '💬',
            url: 'https://discord.com/app',
            color: '#5865F2',
            desc: 'Chat with dev communities',
        },
        {
            id: 'matrix',
            name: 'Matrix',
            icon: '🔐',
            url: 'https://app.element.io',
            color: '#0DBD8B',
            desc: 'Encrypted dev chat (Element)',
        },
        {
            id: 'kaggle',
            name: 'Kaggle',
            icon: '📊',
            url: 'https://www.kaggle.com',
            color: '#20BEFF',
            desc: 'Datasets, notebooks, competitions',
        },
        {
            id: 'termux',
            name: 'Terminal',
            icon: '⬛',
            url: null,
            color: '#2b2b2b',
            desc: 'Termux terminal bridge',
        },
    ],

    render() {
        const container = document.getElementById('page-container');
        container.innerHTML = `
            <div class="page active" id="page-apps">
                <div class="page-header"><h1>Apps</h1></div>
                <div class="apps-grid">
                    ${this.SERVICES.map(s => `
                        <div class="app-card" onclick="AppsPage.open('${s.id}')" style="--card-accent:${s.color}">
                            <div class="app-card-icon">${s.icon}</div>
                            <div class="app-card-name">${s.name}</div>
                            <div class="app-card-desc">${s.desc}</div>
                        </div>
                    `).join('')}
                </div>
                <div id="termux-panel" style="display:none">
                    ${this._renderTerminal()}
                </div>
            </div>`;
    },

    _renderTerminal() {
        return `
            <div class="page-header" style="margin-top:16px">
                <button class="back-btn" onclick="AppsPage.closeTerminal()">← Back</button>
                <h1 style="font-size:18px">Terminal</h1>
                <span class="badge ${Termux.isAvailable() ? 'connected' : 'disconnected'}" style="margin-left:auto;font-size:11px">
                    ${Termux.isAvailable() ? 'Termux Ready' : 'Not Connected'}
                </span>
            </div>
            <div id="term-output" class="term-output"></div>
            <div class="term-input-row">
                <span class="term-prompt">$</span>
                <input id="term-input" type="text" placeholder="Enter command..."
                       autocomplete="off" autocapitalize="off" spellcheck="false"
                       onkeydown="if(event.key==='Enter')AppsPage.runCommand()">
                <button class="btn" style="width:auto;min-height:40px;padding:8px 14px" onclick="AppsPage.runCommand()">Run</button>
            </div>
            ${!Termux.isAvailable() ? `
                <div class="card" style="margin-top:12px">
                    <div class="card-header">Setup</div>
                    <p style="font-size:13px;color:var(--text-muted);margin-bottom:8px">
                        Install <b>Termux</b> and <b>Termux:API</b> from F-Droid, then grant PhoneDev storage access.
                    </p>
                    <button class="btn btn-secondary" onclick="Termux.tryConnect()">Detect Termux</button>
                </div>
            ` : ''}
            <div class="card" style="margin-top:12px">
                <div class="card-header">Quick Commands</div>
                <div class="quick-prompts">
                    ${['ls -la', 'pwd', 'git status', 'node -v', 'python3 --version', 'pkg list-installed'].map(cmd =>
                        `<span class="quick-prompt-chip" onclick="AppsPage.quickCmd('${cmd}')">${cmd}</span>`
                    ).join('')}
                </div>
            </div>`;
    },

    open(id) {
        const svc = this.SERVICES.find(s => s.id === id);
        if (!svc) return;

        if (id === 'termux') {
            document.querySelector('.apps-grid').style.display = 'none';
            const panel = document.getElementById('termux-panel');
            panel.style.display = 'block';
            panel.innerHTML = this._renderTerminal();
            Termux.renderHistory();
            document.getElementById('term-input')?.focus();
            return;
        }

        window.open(svc.url, '_blank', 'noopener');
    },

    closeTerminal() {
        document.querySelector('.apps-grid').style.display = '';
        document.getElementById('termux-panel').style.display = 'none';
    },

    async runCommand() {
        const input = document.getElementById('term-input');
        if (!input) return;
        const cmd = input.value.trim();
        if (!cmd) return;
        input.value = '';

        Termux.addOutput('$ ' + cmd, 'cmd');
        const result = await Termux.execute(cmd);
        Termux.addOutput(result.output, result.error ? 'error' : 'result');
        Termux.renderHistory();
    },

    quickCmd(cmd) {
        const input = document.getElementById('term-input');
        if (input) {
            input.value = cmd;
            this.runCommand();
        }
    },
};
